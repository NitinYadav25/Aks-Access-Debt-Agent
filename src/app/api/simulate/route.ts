import { NextRequest, NextResponse } from 'next/server';
import { getAksService } from '../../../agent/service';
import { CounterfactualSimulator } from '../../../core/simulation';
import { GraphTraversalEngine } from '../../../core/traversal';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateEdgeId = body.candidate_edge_id || body.candidateEdgeId;
    const identityId = body.identity_id || body.identityId;
    const targetId = body.target_id || body.targetId;
    const peerIds = body.peer_ids || body.peerIds || [];
    const maxHops = body.max_hops || body.maxHops || 6;

    if (!candidateEdgeId || !identityId || !targetId) {
      return NextResponse.json(
        { error: 'candidate_edge_id, identity_id, and target_id are required' },
        { status: 400 }
      );
    }

    const aks = getAksService();
    const graph = aks.getGraph();
    const simulator = new CounterfactualSimulator(graph);

    let evaluatedPeerIds: string[] = peerIds;
    if (evaluatedPeerIds.length === 0) {
      const allNodes = graph.getAllNodes();
      const traversal = new GraphTraversalEngine(graph);
      evaluatedPeerIds = allNodes
        .filter((n) => n.type === 'Identity' && n.id !== identityId && n.properties.status === 'active')
        .filter((n) => traversal.findAccessPaths(n.id, { targetId, maxHops }).length > 0)
        .slice(0, 3)
        .map((n) => n.id);
    }

    const result = simulator.simulateEdgeRemoval({
      candidateEdgeId,
      identityId,
      targetId,
      peerIds: evaluatedPeerIds,
      maxHops,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
