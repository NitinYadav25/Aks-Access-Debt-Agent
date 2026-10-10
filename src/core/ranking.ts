import { AccessPath, CandidateEdgeRanking, GraphEdge } from './types';
import { InMemoryAccessGraph } from './graph';

export class CandidateRankingEngine {
  private graph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph) {
    this.graph = graph;
  }

  /**
   * Rank edges along an access path to find the minimal safe change.
   * "Minimum change first. Prefer removing one stale membership or narrow role binding
   * over deleting a broad group, if the smaller change closes the risky path."
   */
  public rankCandidates(path: AccessPath): CandidateEdgeRanking[] {
    const candidates: CandidateEdgeRanking[] = [];

    for (let i = 0; i < path.edges.length; i++) {
      const edge = path.edges[i];
      const sourceNode = this.graph.getNode(edge.source_id);
      const targetNode = this.graph.getNode(edge.target_id);

      const sourceName = sourceNode?.name || edge.source_id;
      const targetName = targetNode?.name || edge.target_id;

      let score = 50;
      let rationale = '';
      let actionDescription = '';
      let rollbackHint = '';

      if (edge.type === 'MEMBER_OF' && i === 0) {
        // Direct membership removal of the risky identity
        score = 95;
        rationale = `Removing ${sourceName}'s direct membership in ${targetName} terminates their inherited access path without affecting other group members.`;
        actionDescription = `Remove identity '${sourceName}' from group '${targetName}'`;
        rollbackHint = `Re-assign membership for '${sourceName}' in group '${targetName}'`;
      } else if (edge.type === 'NESTED_IN') {
        // Group-to-group nesting
        score = 65;
        rationale = `Unlinking group '${sourceName}' from '${targetName}' is a broader change that may impact other members of '${sourceName}'.`;
        actionDescription = `Unnest group '${sourceName}' from parent group '${targetName}'`;
        rollbackHint = `Re-link group '${sourceName}' into '${targetName}'`;
      } else if (edge.type === 'ASSUMES_ROLE') {
        score = 45;
        rationale = `Removing role trust binding '${edge.id}' affects all entities assuming role '${targetName}'.`;
        actionDescription = `Revoke trust binding from '${sourceName}' to role '${targetName}'`;
        rollbackHint = `Restore IAM assume role policy allowing '${sourceName}'`;
      } else if (edge.type === 'GRANTS_ACCESS') {
        score = 30;
        rationale = `Revoking permission grant '${edge.permission || 'access'}' on resource '${targetName}' will impact all users relying on '${sourceName}'.`;
        actionDescription = `Remove permission '${edge.permission || 'access'}' on '${targetName}' granted to '${sourceName}'`;
        rollbackHint = `Re-grant '${edge.permission || 'access'}' permission to '${sourceName}' on '${targetName}'`;
      } else {
        score = 40;
        rationale = `Generic relationship removal for edge '${edge.id}'.`;
        actionDescription = `Remove relationship '${edge.type}' between '${sourceName}' and '${targetName}'`;
        rollbackHint = `Re-create relationship '${edge.type}' between '${sourceName}' and '${targetName}'`;
      }

      candidates.push({
        edge,
        edge_label: `${sourceName} -[${edge.type}]-> ${targetName}`,
        score,
        rationale,
        is_minimal: false,
        action_description: actionDescription,
        rollback_hint: rollbackHint,
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Mark the top candidate as minimal
    if (candidates.length > 0) {
      candidates[0].is_minimal = true;
    }

    return candidates;
  }
}
