import { NextResponse } from 'next/server';
import { ZONES, byId, isValidSelection, totalPrice } from '@/lib/catalog';
import { db, withLock } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const sel = { head: body?.head, body: body?.body, legs: body?.legs };
  // 비정상 파츠 ID 주입 방어: 존재하고 카테고리가 맞는 ID만 허용
  if (!isValidSelection(sel)) {
    return NextResponse.json({ error: 'invalid_selection' }, { status: 400 });
  }
  const name = String(body?.name ?? '').trim();
  const address = String(body?.address ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  if (!name || !address || !phone) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  return withLock(async () => {
    const soldOut = ZONES.filter((z) => (db.stock[sel[z]] ?? 0) < 1);
    if (soldOut.length) {
      return NextResponse.json(
        { error: 'sold_out', zones: soldOut, names: soldOut.map((z) => byId(sel[z]).name) },
        { status: 409 }
      );
    }
    ZONES.forEach((z) => { db.stock[sel[z]] -= 1; });
    const order = {
      id: `FM-${String(db.orders.length + 1).padStart(4, '0')}`,
      parts: sel,
      total: totalPrice(sel), // 클라이언트 금액은 믿지 않고 서버에서 다시 계산
      status: '제작 대기',
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    return NextResponse.json({ id: order.id, total: order.total, status: order.status }, { status: 201 });
  });
}
