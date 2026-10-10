import { InMemoryAccessGraph } from './graph';
import { GraphTraversalEngine } from './traversal';
import { PeerAccessImpact, SimulationResult } from './types';

export interface SimulationOptions {
  candidateEdgeId: string;
  identityId: string;
  targetId: string;
  peerIds?: string[];
  maxHops?: number;
}

export class CounterfactualSimulator {
  private baseGraph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph) {
    this.baseGraph = graph;
  }

  /**
   * Simulate the removal of a candidate edge and compute reachability delta for the identity and peers.
   */
  public simulateEdgeRemoval(options: SimulationOptions): SimulationResult {
    const { candidateEdgeId, identityId, targetId, peerIds = [], maxHops = 6 } = options;

    const edge = this.baseGraph.getEdge(candidateEdgeId);
    if (!edge) {
      throw new Error(`Candidate edge '${candidateEdgeId}' does not exist in graph.`);
    }

    const identityNode = this.baseGraph.getNode(identityId);
    const targetNode = this.baseGraph.getNode(targetId);

    const identityName = identityNode?.name || identityId;
    const targetName = targetNode?.name || targetId;

    const sourceNode = this.baseGraph.getNode(edge.source_id);
    const destinationNode = this.baseGraph.getNode(edge.target_id);
    const edgeLabel = `${sourceNode?.name || edge.source_id} -[${edge.type}]-> ${destinationNode?.name || edge.target_id}`;

    // 1. Base reachability before removal
    const baseEngine = new GraphTraversalEngine(this.baseGraph);
    const initialPaths = baseEngine.findAccessPaths(identityId, {
      targetId,
      maxHops,
    });
    const initialPathCount = initialPaths.length;

    // 2. Fork graph without candidate edge
    const counterfactualGraph = this.baseGraph.cloneWithoutEdge(candidateEdgeId);
    const simEngine = new GraphTraversalEngine(counterfactualGraph);

    // 3. Counterfactual reachability for the subject identity
    const remainingPaths = simEngine.findAccessPaths(identityId, {
      targetId,
      maxHops,
    });
    const remainingCount = remainingPaths.length;
    const pathBroken = initialPathCount > 0 && remainingCount === 0;

    // 4. Counterfactual reachability for peers
    const peerImpact: PeerAccessImpact[] = [];
    let allPeersRetained = true;

    for (const peerId of peerIds) {
      const peerNode = this.baseGraph.getNode(peerId);
      const peerName = peerNode?.name || peerId;

      const peerPathsBefore = baseEngine.findAccessPaths(peerId, {
        targetId,
        maxHops,
      });

      const peerPathsAfter = simEngine.findAccessPaths(peerId, {
        targetId,
        maxHops,
      });

      const retainsAccess = peerPathsBefore.length === 0 || peerPathsAfter.length > 0;
      if (!retainsAccess) {
        allPeersRetained = false;
      }

      peerImpact.push({
        peer_id: peerId,
        peer_name: peerName,
        retains_access: retainsAccess,
        remaining_paths_count: peerPathsAfter.length,
      });
    }

    // 5. Build explainable simulation result
    const isSafeRemediation = pathBroken && allPeersRetained;

    let explanation = '';
    if (pathBroken) {
      if (allPeersRetained) {
        explanation = `Simulation confirms: Removing edge '${edgeLabel}' closes the access path from ${identityName} to ${targetName}. All verified peer access paths remain intact.`;
      } else {
        const brokenPeers = peerImpact
          .filter((p) => !p.retains_access)
          .map((p) => p.peer_name)
          .join(', ');
        explanation = `CAUTION: Removing edge '${edgeLabel}' closes the path for ${identityName}, but unintentionally breaks access for legitimate peers: ${brokenPeers}. A narrower fix is required.`;
      }
    } else {
      explanation = `Edge removal ineffective: Even after removing '${edgeLabel}', ${identityName} retains ${remainingCount} alternative access path(s) to ${targetName}.`;
    }

    return {
      candidate_edge_id: candidateEdgeId,
      candidate_edge_label: edgeLabel,
      target_id: targetId,
      target_name: targetName,
      identity_id: identityId,
      identity_name: identityName,
      risky_path_broken: pathBroken,
      identity_remaining_paths_count: remainingCount,
      peer_impact: peerImpact,
      is_safe_remediation: isSafeRemediation,
      explanation,
    };
  }
}
