import { InMemoryAccessGraph } from '../core/graph';
import { AccessPathSummary, ValidationStatus } from './types';

export class EvidenceValidator {
  private graph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph) {
    this.graph = graph;
  }

  /**
   * Validate that all entities, edges, and path connections cited in the investigation
   * resolve 100% to verified ground-truth graph records.
   * Rejects any fabricated IDs or simulated assertions.
   */
  public validatePaths(paths: AccessPathSummary[]): ValidationStatus {
    const verifiedEntityIds: string[] = [];
    const rejectedClaims: string[] = [];
    let claimsChecked = 0;

    for (const path of paths) {
      // 1. Verify Nodes
      for (const node of path.nodes) {
        claimsChecked += 1;
        const realNode = this.graph.getNode(node.id);
        if (!realNode) {
          rejectedClaims.push(`Fabricated Node ID: '${node.id}' does not exist in graph store.`);
        } else {
          verifiedEntityIds.push(node.id);
        }
      }

      // 2. Verify Edges
      for (const edge of path.edges) {
        claimsChecked += 1;
        const realEdge = this.graph.getEdge(edge.id);
        if (!realEdge) {
          rejectedClaims.push(`Fabricated Edge ID: '${edge.id}' does not exist in graph store.`);
        } else {
          // Verify endpoints match ground truth
          if (realEdge.source_id !== edge.source_id || realEdge.target_id !== edge.target_id) {
            rejectedClaims.push(
              `Invalid Edge Topology: Edge '${edge.id}' connects '${realEdge.source_id}' -> '${realEdge.target_id}' in graph, but path asserted '${edge.source_id}' -> '${edge.target_id}'.`
            );
          } else {
            verifiedEntityIds.push(edge.id);
          }
        }
      }
    }

    return {
      is_valid: rejectedClaims.length === 0,
      total_claims_checked: claimsChecked,
      verified_entity_ids: Array.from(new Set(verifiedEntityIds)),
      rejected_claims: rejectedClaims,
    };
  }

  /**
   * Validate standalone entity IDs cited in natural language or model reasoning.
   */
  public validateEntityIds(ids: string[]): ValidationStatus {
    const verifiedEntityIds: string[] = [];
    const rejectedClaims: string[] = [];

    for (const id of ids) {
      const node = this.graph.getNode(id);
      const edge = this.graph.getEdge(id);

      if (!node && !edge) {
        rejectedClaims.push(`Unverified entity identifier: '${id}' not found in graph records.`);
      } else {
        verifiedEntityIds.push(id);
      }
    }

    return {
      is_valid: rejectedClaims.length === 0,
      total_claims_checked: ids.length,
      verified_entity_ids: verifiedEntityIds,
      rejected_claims: rejectedClaims,
    };
  }
}
