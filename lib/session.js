// 메인 ↔ 주문 사이에서 조합과 캡처 이미지를 넘기는 헬퍼.
// sessionStorage가 막혀 있거나 throw해도 동작하도록 메모리에도 함께 보관한다.
const SEL = 'figumix.selection';
const CAP = 'figumix.capture';
const mem = {};

const safe = (fn) => { try { return fn(); } catch { return null; } };

export const loadSelection = () => {
  const s = safe(() => sessionStorage.getItem(SEL));
  if (s) { try { return JSON.parse(s); } catch { /* fallthrough */ } }
  return mem[SEL] ?? null;
};
export const saveSelection = (sel) => { mem[SEL] = sel; safe(() => sessionStorage.setItem(SEL, JSON.stringify(sel))); };
export const loadCapture = () => safe(() => sessionStorage.getItem(CAP)) || mem[CAP] || null;
export const saveCapture = (img) => {
  mem[CAP] = img || null;
  safe(() => (img ? sessionStorage.setItem(CAP, img) : sessionStorage.removeItem(CAP)));
};
export const clearAll = () => {
  delete mem[SEL]; delete mem[CAP];
  safe(() => { sessionStorage.removeItem(SEL); sessionStorage.removeItem(CAP); });
};

// 베이스 보이기 여부 (주문 화면에서 돌아와도 유지)
const BASE = 'figumix.base';
export const loadBase = () => { const v = safe(() => sessionStorage.getItem(BASE)); return (v ?? mem[BASE]) === '1'; };
export const saveBase = (on) => { mem[BASE] = on ? '1' : '0'; safe(() => sessionStorage.setItem(BASE, on ? '1' : '0')); };
