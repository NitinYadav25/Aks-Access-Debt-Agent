import { NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';

export async function GET() {
  try {
    const aks = getAksService();
    return NextResponse.json(aks.fixtures.scenarios);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
