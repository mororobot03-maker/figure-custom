// 파츠 카탈로그 (서버·클라이언트 공용).
// 실제 서비스에서는 세트 폴더의 info.txt에서 변환 스크립트가 이 구조를 만든다 (ASSET_UPLOAD_RULES.md 8장).
//
// 지금은 .blend/GLB가 아직 없어서 `proc`(임시 절차적 모델 규격)로 3D를 그린다.
// GLB가 들어오면 항목에 `modelUrl`을 채우고 lib/parts3d.js의 loadPart가 GLTFLoader 경로를 타게 하면 된다.
// 단위는 미터(실제 피규어 크기). 세트마다 키·비율이 다르다 → 섞어도 관절 기준으로 붙는지 검증용.

export const ZONES = ['head', 'body', 'legs'];

export const ZONE_META = {
  head: { num: '01', en: 'HEAD', ko: '머리' },
  body: { num: '02', en: 'BODY', ko: '몸통' },
  legs: { num: '03', en: 'LEGS', ko: '하체' },
};

export const SETS = [
  { id: 'set_04', name: 'base', title: '나무결 요정' },
  { id: 'set_01', name: 'mosscap', title: '이끼 버섯 요정' },
  { id: 'set_02', name: 'firefly-knight', title: '반딧불 기사' },
  { id: 'set_03', name: 'willow-moss', title: '버드나무 이끼' },
];


// ── 실제 모델 세트 (OBJ → GLB 변환: tools/convert_obj.py) ─────────────────
// 관절 위치는 변환 도구가 계산한 값(jointPos). 실제 파이프라인에서는 GLB 안의 J_* Empty에서 읽는다.
// 팔이 몸통 메시에 붙어 있어 arm 오브젝트가 없다 → 선택 완료 시 한 바퀴 도는 인사(Plan B).
const REAL = [
  {
    id: 'head_04', category: 'head', setId: 'set_04', name: '나무결 머리', price: 10000, stock: 5,
    modelUrl: '/models/set_04_base_head.glb', jointPos: {"J_neck": [-0.00049, 0.07891, 0.0023]},
    joints: ['J_neck'],
  },
  {
    id: 'body_04', category: 'body', setId: 'set_04', name: '나무결 몸통', price: 8000, stock: 5,
    modelUrl: '/models/set_04_base_body.glb', jointPos: {"J_neck": [-0.00049, 0.07891, 0.0023], "J_waist": [-0.00049, 0.03641, 0.0023]},
    joints: ['J_neck', 'J_waist'],
  },
  {
    id: 'legs_04', category: 'legs', setId: 'set_04', name: '나무결 하체', price: 6000, stock: 5,
    modelUrl: '/models/set_04_base_legs.glb', jointPos: {"J_waist": [-0.00049, 0.03641, 0.0023]},
    joints: ['J_waist'],
  },
];

const PROCEDURAL = [
  // ── 머리 ─────────────────────────────────────────────
  {
    id: 'head_01', category: 'head', setId: 'set_01', name: '발버섯 가면', price: 9000, stock: 5,
    modelUrl: null,
    proc: { kind: 'head', r: 0.024, color: '#b9d8c0', shape: 'cap', accent: '#d98a73' },
    joints: ['J_neck'],
  },
  {
    id: 'head_02', category: 'head', setId: 'set_02', name: '반딧불 뿔모자', price: 11000, stock: 3,
    modelUrl: null,
    proc: { kind: 'head', r: 0.02, color: '#e8d9a0', shape: 'horn', accent: '#8fb596' },
    joints: ['J_neck'],
  },
  {
    id: 'head_03', category: 'head', setId: 'set_03', name: '이끼 두건', price: 8500, stock: 4,
    modelUrl: null,
    proc: { kind: 'head', r: 0.026, color: '#8fb596', shape: 'hood', accent: '#4c7355' },
    joints: ['J_neck'],
  },

  // ── 몸통 (팔은 몸통을 따라다닌다) ──────────────────────────
  {
    id: 'body_01', category: 'body', setId: 'set_01', name: '늪지 망토', price: 7200, stock: 5,
    modelUrl: null,
    proc: { kind: 'body', legsH: 0.034, h: 0.04, wBottom: 0.03, wTop: 0.014, color: '#a9c7b3', arm: { len: 0.026, color: '#a9c7b3' } },
    joints: ['J_neck', 'J_waist', 'J_shoulder_R1'],
  },
  {
    id: 'body_02', category: 'body', setId: 'set_02', name: '거북 등껍질 갑옷', price: 12000, stock: 2,
    modelUrl: null,
    proc: { kind: 'body', legsH: 0.04, h: 0.05, wBottom: 0.026, wTop: 0.03, color: '#7fb8c9', arm: { len: 0.03, color: '#7fb8c9' } },
    joints: ['J_neck', 'J_waist', 'J_shoulder_R1'],
  },
  {
    id: 'body_03', category: 'body', setId: 'set_03', name: '버드나무 망토', price: 9800, stock: 4,
    modelUrl: null,
    // 팔 없는 몸통 → 인사 모션 Plan B(점프+한 바퀴) 검증용
    proc: { kind: 'body', legsH: 0.032, h: 0.045, wBottom: 0.034, wTop: 0.012, color: '#9fc58f', arm: null },
    joints: ['J_neck', 'J_waist'],
  },

  // ── 하체 ─────────────────────────────────────────────
  {
    id: 'legs_01', category: 'legs', setId: 'set_01', name: '늪의 발톱', price: 5000, stock: 5,
    modelUrl: null,
    proc: { kind: 'legs', h: 0.034, w: 0.014, color: '#c8d9b4', foot: 'claw' },
    joints: ['J_waist'],
  },
  {
    id: 'legs_02', category: 'legs', setId: 'set_02', name: '뿌리다리', price: 6400, stock: 3,
    modelUrl: null,
    proc: { kind: 'legs', h: 0.04, w: 0.012, color: '#b5a079', foot: 'root' },
    joints: ['J_waist'],
  },
  {
    id: 'legs_03', category: 'legs', setId: 'set_03', name: '이끼 각반', price: 5800, stock: 0,
    modelUrl: null,
    proc: { kind: 'legs', h: 0.032, w: 0.016, color: '#7fae82', foot: 'round' },
    joints: ['J_waist'],
  },
];

export const CATALOG = [...REAL, ...PROCEDURAL];

// 베이스(받침대): 파츠가 아니라 선택 사항 장식. 나무결 하체 원본 좌표에 맞춰 만들어져 있다.
export const BASE = {
  id: 'base_04', category: 'base', name: '나무결 베이스',
  modelUrl: '/models/set_04_base_stand.glb', joints: [],
};

export const byCategory = (cat) => CATALOG.filter((p) => p.category === cat);
export const byId = (id) => CATALOG.find((p) => p.id === id) || null;

// 원본 세트: 머리와 같은 setId의 몸통·하체
export function originalSetFor(headId) {
  const head = byId(headId);
  if (!head) return null;
  const body = CATALOG.find((p) => p.category === 'body' && p.setId === head.setId);
  const legs = CATALOG.find((p) => p.category === 'legs' && p.setId === head.setId);
  if (!body || !legs) return null;
  return { head: head.id, body: body.id, legs: legs.id };
}

export const DEFAULT_SELECTION = originalSetFor('head_04');

export function isValidSelection(sel) {
  return !!sel && ZONES.every((z) => {
    const p = byId(sel[z]);
    return p && p.category === z;
  });
}

export function totalPrice(sel) {
  return ZONES.reduce((sum, z) => sum + (byId(sel[z])?.price || 0), 0);
}

export const won = (n) => `${n.toLocaleString('ko-KR')}원`;
