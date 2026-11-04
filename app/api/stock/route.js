import { NextResponse } from 'next/server';
import { db } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ stock: db.stock });
}
