import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../../agent/service';
import { IngestPayload } from '../../../../core/ingest';

export async function POST(req: NextRequest) {
  try {
    const payload: IngestPayload = await req.json();

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Valid JSON ingest payload is required' }, { status: 400 });
    }

    const aks = getAksService();
    const result = aks.ingestPayload(payload);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
