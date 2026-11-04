// next/navigation 대체: 한 페이지 안에서 main ↔ order를 전환한다 (artifact는 #name 해시만 허용)
const subs = new Set();
let view = typeof location !== 'undefined' && location.hash === '#order' ? 'order' : 'main';
export const currentView = () => view;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function useRouter() {
  return {
    push(path) {
      view = path.startsWith('/order') ? 'order' : 'main';
      try { location.hash = view === 'order' ? 'order' : ''; } catch { /* 무시 */ }
      subs.forEach((f) => f(view));
    },
  };
}
