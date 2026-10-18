import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../../agent/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.toLowerCase() || '';
    const type = searchParams.get('type') || '';
    const sensitivity = searchParams.get('sensitivity') || '';

    const aks = getAksService();
    const graph = aks.getGraph();
    const evidenceList = aks.getRawEvidence();
    let nodes = graph.getAllNodes();

    if (type) {
      nodes = nodes.filter((n) => n.type.toLowerCase() === type.toLowerCase());
    }

    if (sensitivity) {
      nodes = nodes.filter(
        (n) => n.properties.sensitivity_label?.toLowerCase() === sensitivity.toLowerCase()
      );
    }

    if (search) {
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(search) ||
          n.id.toLowerCase().includes(search) ||
          String(n.properties.email || '').toLowerCase().includes(search) ||
          String(n.properties.department || '').toLowerCase().includes(search)
      );
    }

    const enrichedNodes = nodes.map((node) => {
      const outgoing = graph.getOutgoingEdges(node.id);
      const incoming = graph.getIncomingEdges(node.id);
      const matchingEvidence = evidenceList.filter(
        (ev) =>
          ev.entity_id === node.id ||
          ev.payload?.user_id === node.id ||
          ev.payload?.email === node.properties.email ||
          ev.id.includes(node.id)
      );

      return {
        ...node,
        outgoing_edges_count: outgoing.length,
        incoming_edges_count: incoming.length,
        evidence_records_count: matchingEvidence.length,
      };
    });

    return NextResponse.json({
      total: enrichedNodes.length,
      nodes: enrichedNodes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
