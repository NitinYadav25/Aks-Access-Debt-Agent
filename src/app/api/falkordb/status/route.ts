import { NextRequest, NextResponse } from 'next/server';
import { getFalkorDBService } from '../../../../core/falkordb/client';
import { getAksService } from '../../../../agent/service';

export async function GET() {
  try {
    const falkor = getFalkorDBService();
    const aks = getAksService();
    const graph = aks.getGraph();

    // Auto-update node and edge counts in status
    const status = falkor.getStatus();
    status.nodeCount = graph.getAllNodes().length;
    status.edgeCount = graph.getAllEdges().length;

    return NextResponse.json({
      status,
      config: falkor.getConfig(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const falkor = getFalkorDBService();

    const newConfig: Record<string, any> = {};
    if (body.url !== undefined) newConfig.url = body.url;
    if (body.host !== undefined) newConfig.host = body.host;
    if (body.port !== undefined) newConfig.port = Number(body.port);
    if (body.password !== undefined) newConfig.password = body.password;
    if (body.graphName !== undefined) newConfig.graphName = body.graphName;

    const status = await falkor.updateConfig(newConfig);

    return NextResponse.json({
      status,
      config: falkor.getConfig(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
