import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, subject_id, target_id, max_hops } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const aks = getAksService();
    const result = await aks.orchestrator.investigate({
      question,
      subject_id,
      target_id,
      max_hops,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
