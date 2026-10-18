import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../../agent/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nodeId = searchParams.get('node_id');
    const type = searchParams.get('type');

    const aks = getAksService();
    const graph = aks.getGraph();
    let edges = graph.getAllEdges();

    if (nodeId) {
      edges = edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId);
    }

    if (type) {
      edges = edges.filter((e) => e.type.toLowerCase() === type.toLowerCase());
    }

    const enrichedEdges = edges.map((e) => {
      const sourceNode = graph.getNode(e.source_id);
      const targetNode = graph.getNode(e.target_id);

      return {
        ...e,
        source_name: sourceNode?.name || e.source_id,
        source_type: sourceNode?.type,
        target_name: targetNode?.name || e.target_id,
        target_type: targetNode?.type,
        target_sensitivity: targetNode?.properties?.sensitivity_label,
      };
    });

    return NextResponse.json({
      total: enrichedEdges.length,
      edges: enrichedEdges,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
