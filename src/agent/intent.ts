import { InMemoryAccessGraph } from '../core/graph';
import { InvestigationQuery } from './types';

export interface ResolvedIntent {
  subject_id: string;
  subject_name: string;
  target_id?: string;
  target_name?: string;
  max_hops: number;
}

export class IntentResolver {
  private graph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph) {
    this.graph = graph;
  }

  /**
   * Resolve subject entity and destination target from query or explicit parameters.
   */
  public resolveIntent(query: InvestigationQuery): ResolvedIntent {
    let subjectId = query.subject_id;
    let targetId = query.target_id;
    const maxHops = query.max_hops ?? 6;

    const lowerQ = query.question.toLowerCase();

    // 1. Resolve subject if not explicitly specified
    if (!subjectId) {
      const allIdentities = this.graph
        .getAllNodes()
        .filter((n) => n.type === 'Identity');

      for (const idNode of allIdentities) {
        const firstName = idNode.name.toLowerCase().split(' ')[0];
        const fullName = idNode.name.toLowerCase();
        if (lowerQ.includes(firstName) || lowerQ.includes(fullName) || lowerQ.includes(idNode.id.toLowerCase())) {
          subjectId = idNode.id;
          break;
        }
      }
    }

    // Default fallback to first identity if not found
    if (!subjectId) {
      subjectId = 'usr_nisha_patel';
    }

    const subjectNode = this.graph.getNode(subjectId);
    const subjectName = subjectNode?.name || subjectId;

    // 2. Resolve target resource if not explicitly specified
    if (!targetId) {
      const allResources = this.graph
        .getAllNodes()
        .filter((n) => n.type === 'Repository' || n.type === 'CloudResource');

      for (const resNode of allResources) {
        const lowerResName = resNode.name.toLowerCase();
        if (
          lowerQ.includes(lowerResName) ||
          lowerQ.includes(resNode.id.toLowerCase()) ||
          (lowerQ.includes('billing') && lowerResName.includes('billing')) ||
          (lowerQ.includes('pii') && lowerResName.includes('pii')) ||
          (lowerQ.includes('customer') && lowerResName.includes('customer'))
        ) {
          targetId = resNode.id;
          break;
        }
      }
    }

    const targetNode = targetId ? this.graph.getNode(targetId) : undefined;
    const targetName = targetNode?.name || targetId;

    return {
      subject_id: subjectId,
      subject_name: subjectName,
      target_id: targetId,
      target_name: targetName,
      max_hops: maxHops,
    };
  }
}
