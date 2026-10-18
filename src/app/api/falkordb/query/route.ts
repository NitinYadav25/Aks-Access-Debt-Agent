import { NextRequest, NextResponse } from 'next/server';
import { getFalkorDBService } from '../../../../core/falkordb/client';
import { getAksService } from '../../../../agent/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cypher = body.cypher || body.query;
    const params = body.params || {};

    if (!cypher || typeof cypher !== 'string') {
      return NextResponse.json({ error: 'cypher query string is required' }, { status: 400 });
    }

    const falkor = getFalkorDBService();
    const aks = getAksService();
    const graph = aks.getGraph();

    const result = await falkor.query(cypher, params, graph);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
