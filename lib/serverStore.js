// 서버 메모리 재고·주문 저장소 (시연용). 실제 서비스에서는 RDBMS + 행 잠금으로 교체.
// 개인정보(이름·주소·연락처)는 저장하지 않는다 — PRD 7장. 주문에는 파츠 ID·합계·상태만 남긴다.
import { CATALOG } from './catalog';

const g = globalThis;
if (!g.__figumix) {
  g.__figumix = {
    stock: Object.fromEntries(CATALOG.map((p) => [p.id, p.stock])),
    orders: [],
    chain: Promise.resolve(), // 주문 처리를 한 줄로 세우는 잠금
  };
}
export const db = g.__figumix;

// 재고 확인 + 차감 + 주문 생성을 한 번에(다른 주문이 끼어들 수 없게) 처리
export function withLock(fn) {
  const run = db.chain.then(fn, fn);
  db.chain = run.catch(() => {});
  return run;
}
