// 3D 파츠 로더 (클라이언트 전용).
// 반환 형태는 GLB로 바뀌어도 동일하게 유지한다:
//   { group: THREE.Group, joints: { J_neck: Vector3, ... }, arm: THREE.Object3D | null, id }
// - group 안의 모든 좌표는 "세트 원본 좌표" (Blender 원점 기준, 하체 바닥 = y 0)
// - joints는 group 로컬 좌표의 관절 위치
// - arm은 팔 오브젝트(원점 = 어깨 관절). 몸통에만 있고, 없으면 null → 인사 모션 Plan B

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    ...extra,
  });
}

function buildHead(p) {
  const { r, color, shape, accent } = p.proc;
  // 같은 세트의 몸통/하체 규격과 맞추기 위해 세트별 목 높이를 상수로 가진다
  const neckY = NECK_Y[p.setId];
  const g = new THREE.Group();
  const cy = neckY + r * 0.95;

  const skull = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat(color));
  skull.position.set(0, cy, 0);
  g.add(skull);

  // 눈 두 개 (정면 +Z)
  const eyeMat = mat('#1b2a26', { roughness: 0.3 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 12, 10), eyeMat);
    eye.position.set(sx * r * 0.38, cy + r * 0.05, r * 0.88);
    g.add(eye);
  }

  if (shape === 'cap') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.25, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
      mat(accent)
    );
    cap.position.set(0, cy + r * 0.25, 0);
    g.add(cap);
  } else if (shape === 'horn') {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, r * 1.2, 16), mat(accent));
      horn.position.set(sx * r * 0.6, cy + r * 1.05, 0);
      horn.rotation.z = -sx * 0.35;
      g.add(horn);
    }
  } else if (shape === 'hood') {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.12, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mat(accent, { side: THREE.DoubleSide })
    );
    hood.position.set(0, cy + r * 0.05, -r * 0.1);
    g.add(hood);
  }

  const joints = { J_neck: new THREE.Vector3(0, neckY, 0) };
  return { group: g, joints, arm: null };
}

function buildBody(p) {
  const { legsH, h, wBottom, wTop, color, arm } = p.proc;
  const g = new THREE.Group();

  // 몸통: 아래가 넓은 원뿔대 (망토 느낌)
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(wTop, wBottom, h, 32, 1),
    mat(color)
  );
  torso.position.set(0, legsH + h / 2, 0);
  g.add(torso);

  // 가슴 장식
  const gem = new THREE.Mesh(new THREE.SphereGeometry(wTop * 0.22, 16, 12), mat('#e8d9a0', { emissive: '#e8d9a0', emissiveIntensity: 0.35 }));
  gem.position.set(0, legsH + h * 0.7, wTop * 0.92);
  g.add(gem);

  const joints = {
    J_waist: new THREE.Vector3(0, legsH, 0),
    J_neck: new THREE.Vector3(0, legsH + h, 0),
  };

  let armObj = null;
  if (arm) {
    // 사람형: 어깨는 피규어의 오른쪽 = -X. 팔 오브젝트의 원점이 어깨 관절.
    const shoulder = new THREE.Vector3(-(wTop + 0.004), legsH + h * 0.85, 0);
    joints.J_shoulder_R1 = shoulder.clone();
    armObj = new THREE.Group();
    armObj.name = 'arm_R1';
    armObj.position.copy(shoulder);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, arm.len, 8, 16), mat(arm.color));
    limb.position.set(0, -arm.len / 2, 0); // 어깨에서 아래로 늘어짐
    armObj.add(limb);
    g.add(armObj);

    // 왼팔은 몸통에 붙은 상태(인사에 쓰지 않음)
    const left = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, arm.len, 8, 16), mat(arm.color));
    left.position.set(wTop + 0.004, legsH + h * 0.85 - arm.len / 2, 0);
    g.add(left);
  }
  return { group: g, joints, arm: armObj };
}

function buildLegs(p) {
  const { h, w, color, foot } = p.proc;
  const g = new THREE.Group();
  const legMat = mat(color);

  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.7, h, 20), legMat);
    leg.position.set(sx * w * 0.9, h / 2, 0);
    g.add(leg);

    let f;
    if (foot === 'claw') {
      f = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, w * 1.6, 5), mat('#b5604a'));
      f.rotation.x = Math.PI / 2;
      f.position.set(sx * w * 0.9, w * 0.35, w * 0.6);
    } else if (foot === 'root') {
      f = new THREE.Mesh(new THREE.SphereGeometry(w * 0.95, 16, 12), mat('#8a7650'));
      f.scale.set(1, 0.5, 1.3);
      f.position.set(sx * w * 0.9, w * 0.25, w * 0.25);
    } else {
      f = new THREE.Mesh(new THREE.SphereGeometry(w * 0.9, 16, 12), mat('#4c7355'));
      f.scale.set(1, 0.6, 1.2);
      f.position.set(sx * w * 0.9, w * 0.3, w * 0.2);
    }
    g.add(f);
  }

  const joints = { J_waist: new THREE.Vector3(0, h, 0) };
  return { group: g, joints, arm: null };
}

// 세트별 목 높이(= legsH + bodyH). 머리가 같은 세트의 몸통 목 관절과 같은 높이를 갖도록.
const NECK_Y = { set_01: 0.074, set_02: 0.09, set_03: 0.077 };

function buildProcedural(entry) {
  switch (entry.category) {
    case 'head': return buildHead(entry);
    case 'body': return buildBody(entry);
    case 'legs': return buildLegs(entry);
    default: throw new Error(`알 수 없는 카테고리: ${entry.category}`);
  }
}

// GLB 파츠 로드. 반환 형태는 절차적 파츠와 같다.
// - 관절: GLB 안의 J_* 노드가 있으면 그 위치, 없으면 카탈로그의 jointPos
// - 팔: 이름이 arm_R1인 노드 (없으면 null → 인사 모션 Plan B)
// - ?artifact 단일 HTML 빌드는 window.__FIGUMIX_MODELS__[url] 에 base64로 모델을 담아 둔다
const gltfLoader = new GLTFLoader();

function decodeBase64(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function buildFromModel(entry) {
  const inline = typeof window !== 'undefined' && window.__FIGUMIX_MODELS__?.[entry.modelUrl];
  const gltf = inline
    ? await gltfLoader.parseAsync(decodeBase64(inline), '')
    : await gltfLoader.loadAsync(entry.modelUrl);

  const group = new THREE.Group();
  group.add(gltf.scene);

  const joints = {};
  Object.entries(entry.jointPos || {}).forEach(([k, v]) => { joints[k] = new THREE.Vector3(...v); });
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (o.name && o.name.startsWith('J_')) joints[o.name] = o.getWorldPosition(new THREE.Vector3());
    if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  const missing = (entry.joints || []).filter((j) => !joints[j]);
  if (missing.length) throw new Error(`${entry.id}: 필수 관절 없음 (${missing.join(', ')})`);

  const arm = gltf.scene.getObjectByName('arm_R1') || null;
  return { group, joints, arm };
}

export function loadPart(entry) {
  if (cache.has(entry.id)) return cache.get(entry.id);
  const promise = new Promise((resolve, reject) => {
    // 실제 네트워크 로딩처럼 비동기 + 약간의 지연 (로딩 상태 UI 검증용)
    setTimeout(async () => {
      try {
        const built = entry.modelUrl ? await buildFromModel(entry) : buildProcedural(entry);
        built.group.traverse((o) => {
          if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
        });
        resolve({ ...built, id: entry.id });
      } catch (e) {
        cache.delete(entry.id);
        reject(e);
      }
    }, 140);
  });
  cache.set(entry.id, promise);
  return promise;
}
