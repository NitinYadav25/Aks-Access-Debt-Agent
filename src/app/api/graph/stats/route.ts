import { NextResponse } from 'next/server';
import { getAksService } from '../../../../agent/service';

export async function GET() {
  try {
    const aks = getAksService();
    const stats = aks.getStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
