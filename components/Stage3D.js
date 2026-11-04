'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BASE, byId, ZONES } from '@/lib/catalog';
import { loadPart } from '@/lib/parts3d';
import { assemble } from '@/lib/assemble';

const FOV = 35;
const ELEV = (10 * Math.PI) / 180; // 정면에서 살짝 위
const COLORS = {
  surface: '#0c1b19',
  surfaceHigh: '#1e433b',
  mossDark: '#4c7355',
  mossLight: '#8fb596',
  gold: '#e8d9a0',
  ivory: '#fff3e0',
  mist: '#7fb8c9',
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function glowTexture(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function mossTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#5f8a62');
  grad.addColorStop(0.7, COLORS.mossDark);
  grad.addColorStop(1, 'rgba(76,115,85,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // 이끼 알갱이
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (S / 2) * 0.95;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    const fade = 1 - r / (S / 2);
    g.fillStyle = rnd() > 0.5 ? `rgba(143,181,150,${0.35 * fade})` : `rgba(32,70,48,${0.5 * fade})`;
    g.beginPath();
    g.arc(x, y, 1 + rnd() * 3.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = COLORS.surface;
  g.fillRect(0, 0, 256, 512);
  const grad = g.createRadialGradient(128, 230, 0, 128, 230, 300);
  grad.addColorStop(0, 'rgba(46, 96, 84, 0.75)');
  grad.addColorStop(0.55, 'rgba(30, 67, 59, 0.35)');
  grad.addColorStop(1, 'rgba(12, 27, 25, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const Stage3D = forwardRef(function Stage3D(
  { selection, showBase = false, retryKey = 0, onStatus, onZoneLoading, onZoneError, onBaseError, onInteract },
  ref
) {
  const hostRef = useRef(null);
  const ctx = useRef(null);
  const cb = useRef({});
  cb.current = { onStatus, onZoneLoading, onZoneError, onBaseError, onInteract };

  // ── 씬 생성 (한 번) ─────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = backgroundTexture();
    scene.fog = new THREE.Fog(COLORS.surface, 0.55, 1.6);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false; // PRD: pan 제외
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;
    let interacted = false;
    controls.addEventListener('start', () => {
      if (!interacted) { interacted = true; cb.current.onInteract?.(); }
    });

    // 조명: 주광은 거의 무채색, 색은 보조광·림 라이트로만
    scene.add(new THREE.HemisphereLight('#9fb3a9', COLORS.surface, 0.9));
    const key = new THREE.DirectionalLight(COLORS.ivory, 2.2);
    key.position.set(0.4, 0.9, 0.8);
    const fill = new THREE.DirectionalLight(COLORS.mist, 0.7);
    fill.position.set(-0.8, 0.2, 0.4);
    const rim = new THREE.DirectionalLight(COLORS.gold, 1.6);
    rim.position.set(0, 0.5, -0.9);
    scene.add(key, fill, rim);

    // 이끼 바닥 + 접지 그림자 + 금빛 테두리
    const floor = new THREE.Group();
    const moss = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ map: mossTexture(), transparent: true, depthWrite: false })
    );
    moss.rotation.x = -Math.PI / 2;
    moss.position.y = -0.0004;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        map: glowTexture('rgba(4,12,10,0.65)'),
        transparent: true,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.0003;
    shadow.userData.shadow = true;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.975, 1, 96),
      new THREE.MeshBasicMaterial({
        color: COLORS.gold, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.0002;
    floor.add(moss, shadow, ring);
    scene.add(floor);

    // 반딧불 입자: 피규어 뒤·옆에만
    const FIREFLIES = 16;
    const ffGeo = new THREE.BufferGeometry();
    const ffBase = [];
    const pos = new Float32Array(FIREFLIES * 3);
    let s2 = 11;
    const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < FIREFLIES; i++) {
      const side = r2() > 0.5 ? 1 : -1;
      const x = side * (0.07 + r2() * 0.22);
      const y = 0.01 + r2() * 0.2;
      const z = -0.25 + r2() * 0.3; // 앞(+z)을 가로지르지 않게
      ffBase.push({ x, y, z, p: r2() * 6.28, sp: 0.3 + r2() * 0.5 });
      pos.set([x, y, z], i * 3);
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const fireflies = new THREE.Points(
      ffGeo,
      new THREE.PointsMaterial({
        size: 0.014, map: glowTexture('rgba(232,217,160,1)'), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      })
    );
    scene.add(fireflies);

    const figure = new THREE.Group();
    scene.add(figure);
    // 베이스(받침대): 파츠와 별개. 인사 모션의 한 바퀴 회전은 함께 돌고, 점프는 하지 않는다.
    const baseGroup = new THREE.Group();
    baseGroup.visible = false;
    scene.add(baseGroup);

    const S = {
      renderer, scene, camera, controls, figure, floor, fireflies, ffBase,
      baseGroup, baseLoaded: false, baseMinY: 0,
      loaded: {}, want: {}, fit: null, raf: 0, ready: false, busy: false,
    };
    ctx.current = S;
    // 점검용: ?debug로 열었을 때만 장면 접근을 열어 둔다
    if (new URLSearchParams(window.location.search).has('debug')) window.__stage = S;

    // 크기
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (S.fit) refit(S, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // 렌더 루프
    const clock = new THREE.Clock();
    const loop = () => {
      S.raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (!reducedMotion()) {
        const p = fireflies.geometry.attributes.position;
        ffBase.forEach((f, i) => {
          p.setXYZ(
            i,
            f.x + Math.sin(t * f.sp + f.p) * 0.012,
            f.y + Math.sin(t * f.sp * 1.3 + f.p) * 0.01,
            f.z + Math.cos(t * f.sp + f.p) * 0.01
          );
        });
        p.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(S.raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  // ── 선택 변경 → 파츠 로드 → (모두 준비되면) 조립 ─────────────────
  useEffect(() => {
    const S = ctx.current;
    if (!S || !selection) return;
    let cancelled = false;

    ZONES.forEach((zone) => {
      const id = selection[zone];
      S.want[zone] = id;
      if (S.loaded[zone]?.id === id) return;
      const entry = byId(id);
      cb.current.onZoneLoading?.(zone, true);
      loadPart(entry)
        .then((part) => {
          if (cancelled || S.want[zone] !== id) return; // 더 새로운 요청이 있으면 버린다
          S.loaded[zone] = part;
          cb.current.onZoneLoading?.(zone, false);
          if (ZONES.every((z) => S.loaded[z])) {
            const first = !S.fit;
            const parts = { head: S.loaded.head, body: S.loaded.body, legs: S.loaded.legs };
            const m = assemble(parts, S.figure);
            S.fit = { ...m, parts };
            refit(S, first);
            if (first) { S.ready = true; cb.current.onStatus?.('ready'); }
          }
        })
        .catch(() => {
          if (cancelled) return;
          cb.current.onZoneLoading?.(zone, false);
          if (!S.ready) cb.current.onStatus?.('error');
          else cb.current.onZoneError?.(zone);
        });
    });

    return () => { cancelled = true; };
  }, [selection?.head, selection?.body, selection?.legs, retryKey]);

  // ── 베이스 보이기/숨기기 ──────────────────────────────────────
  useEffect(() => {
    const S = ctx.current;
    if (!S) return;
    let cancelled = false;
    const apply = () => {
      S.baseGroup.visible = showBase;
      // 베이스가 보이면 바닥(이끼·그림자·테두리)을 베이스 밑면까지 내린다
      S.floor.position.y = showBase ? S.baseMinY : 0;
    };
    if (!showBase || S.baseLoaded) { apply(); return; }
    loadPart(BASE)
      .then((part) => {
        if (cancelled) return;
        S.baseGroup.add(part.group);
        S.baseGroup.updateMatrixWorld(true);
        S.baseMinY = Math.min(0, new THREE.Box3().setFromObject(S.baseGroup).min.y);
        S.baseLoaded = true;
        apply();
      })
      .catch(() => { if (!cancelled) cb.current.onBaseError?.(); });
    return () => { cancelled = true; };
  }, [showBase]);

  // ── 외부 명령 ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    // 선택 완료: 정면 이동 → 캡처 → 인사 모션
    async runGreeting() {
      const S = ctx.current;
      if (!S || !S.fit || S.busy) return { image: null };
      S.busy = true;
      S.controls.enabled = false;
      const reduce = reducedMotion();
      try {
        await tweenToFront(S, reduce ? 0 : 600);
        const image = capture(S);
        if (!reduce) await greet(S);
        return { image };
      } finally {
        S.controls.enabled = true;
        S.busy = false;
      }
    },
  }));

  return <div ref={hostRef} id="stage-canvas-host" style={{ position: 'absolute', inset: 0 }} />;
});

export default Stage3D;

// ───────────────────────── helpers ─────────────────────────

function defaultView(S) {
  const { height, width } = S.fit;
  const vh = 2 * Math.tan((FOV * Math.PI) / 360); // 거리 1에서 보이는 세로 길이
  const dH = height / (0.44 * vh);
  const dW = (width * 2.2) / (vh * S.camera.aspect);
  const d = Math.max(dH, dW);
  const target = new THREE.Vector3(0, height * 0.48, 0);
  return { d, target };
}

// 조합이 바뀌었을 때(키가 달라질 때) 카메라 거리·바닥 크기 재계산
function refit(S, first) {
  const { d, target } = defaultView(S);
  const { camera, controls } = S;
  const h = S.fit.height;

  if (first || !S.view) {
    camera.position.set(0, target.y + Math.sin(ELEV) * d, Math.cos(ELEV) * d);
    controls.target.copy(target);
  } else {
    const off = camera.position.clone().sub(controls.target).multiplyScalar(d / S.view.d);
    controls.target.copy(target);
    camera.position.copy(target).add(off);
  }
  controls.minDistance = d * 0.45;
  controls.maxDistance = d * 2.2;
  controls.update();
  S.view = { d, target };

  const R = h * 0.6 * 1.25;
  S.floor.children.forEach((m) => m.scale.setScalar(m.userData.shadow ? h * 0.32 : R));
  S.scene.fog.near = d * 1.4;
  S.scene.fog.far = d * 4.2;
}

function tweenToFront(S, ms) {
  const { camera, controls } = S;
  const { d, target } = defaultView(S);
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const fromT = controls.target.clone();
  const toSph = new THREE.Spherical(d, Math.PI / 2 - ELEV, 0);
  // 최단 경로로 회전
  let dTheta = toSph.theta - from.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));

  const apply = (k) => {
    const sph = new THREE.Spherical(
      from.radius + (toSph.radius - from.radius) * k,
      from.phi + (toSph.phi - from.phi) * k,
      from.theta + dTheta * k
    );
    controls.target.lerpVectors(fromT, target, k);
    camera.position.setFromSpherical(sph).add(controls.target);
    camera.lookAt(controls.target);
  };
  S.view = { d, target };
  if (ms <= 0) { apply(1); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      apply(easeInOut(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

// 주문 요약용 캡처: 3:4 비율로 가운데를 잘라 저장
function capture(S) {
  S.renderer.render(S.scene, S.camera);
  const src = S.renderer.domElement;
  const W = 480, H = 640;
  const aspect = W / H;
  let sw = src.width, sh = src.height;
  if (sw / sh > aspect) sw = sh * aspect; else sh = sw / aspect;
  const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.85);
}

// 인사 모션 (약 1.5초). 팔(arm_R1)이 있으면 어깨 축으로 흔들고, 없으면 점프+한 바퀴(Plan B)
function greet(S) {
  const arm = S.fit.parts.body.arm;
  const TOTAL = 1500;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(TOTAL, now - t0);
      if (arm) {
        let a;
        if (t < 350) a = -2.45 * easeInOut(t / 350);
        else if (t < 1150) a = -2.45 + 0.35 * Math.sin(((t - 350) / 800) * Math.PI * 4);
        else a = -2.45 * (1 - easeInOut((t - 1150) / 350));
        arm.rotation.z = a;
      } else {
        const k = t / TOTAL;
        S.figure.position.y = Math.abs(Math.sin(k * Math.PI)) * S.fit.height * 0.1;
        S.figure.rotation.y = easeInOut(k) * Math.PI * 2;
        S.baseGroup.rotation.y = S.figure.rotation.y;
      }
      if (t < TOTAL) requestAnimationFrame(step);
      else {
        if (arm) arm.rotation.z = 0;
        S.figure.position.y = 0;
        S.figure.rotation.y = 0;
        S.baseGroup.rotation.y = 0;
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
