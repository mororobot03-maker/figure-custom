// /api/stock, /api/orders 를 브라우저 안에서 흉내 낸다 (서버 로직과 같은 규칙).
import { CATALOG, ZONES, byId, isValidSelection, totalPrice } from '../lib/catalog.js';

const stock = Object.fromEntries(CATALOG.map((p) => [p.id, p.stock]));
let orderNo = 0;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('/api/stock')) return json({ stock });
  if (u.startsWith('/api/orders') && (opts.method || 'GET') === 'POST') {
    await new Promise((r) => setTimeout(r, 300));
    let b;
    try { b = JSON.parse(opts.body); } catch { return json({ error: 'bad_request' }, 400); }
    const sel = { head: b.head, body: b.body, legs: b.legs };
    if (!isValidSelection(sel)) return json({ error: 'invalid_selection' }, 400);
    if (!String(b.name || '').trim() || !String(b.address || '').trim() || !String(b.phone || '').trim())
      return json({ error: 'missing_fields' }, 400);
    const sold = ZONES.filter((z) => (stock[sel[z]] ?? 0) < 1);
    if (sold.length) return json({ error: 'sold_out', zones: sold, names: sold.map((z) => byId(sel[z]).name) }, 409);
    ZONES.forEach((z) => { stock[sel[z]] -= 1; });
    orderNo += 1;
    return json({ id: `FM-${String(orderNo).padStart(4, '0')}`, total: totalPrice(sel), status: '제작 대기' }, 201);
  }
  return realFetch(url, opts);
};
