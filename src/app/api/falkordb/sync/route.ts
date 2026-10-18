import { NextResponse } from 'next/server';
import { getFalkorDBService } from '../../../../core/falkordb/client';
import { getAksService } from '../../../../agent/service';

export async function POST() {
  try {
    const falkor = getFalkorDBService();
    const aks = getAksService();
    const graph = aks.getGraph();

    const result = await falkor.syncGraph(graph);

    return NextResponse.json({
      ...result,
      status: falkor.getStatus(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
