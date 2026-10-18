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

      // Sort by name length descending so longer/full names match first
      const sortedIdentities = [...allIdentities].sort((a, b) => b.name.length - a.name.length);

      for (const idNode of sortedIdentities) {
        const nameParts = idNode.name.toLowerCase().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts[nameParts.length - 1] || '';
        const fullName = idNode.name.toLowerCase();
        const idLower = idNode.id.toLowerCase();
        const email = String(idNode.properties.email || '').toLowerCase();
        const emailPrefix = email.split('@')[0] || '';

        // Check full name, first name, last name, ID, or email match
        const matches =
          lowerQ.includes(fullName) ||
          (firstName.length > 2 && lowerQ.includes(firstName)) ||
          (lastName.length > 2 && lowerQ.includes(lastName)) ||
          lowerQ.includes(idLower) ||
          (emailPrefix.length > 2 && lowerQ.includes(emailPrefix)) ||
          (idNode.properties.is_service_account &&
            (lowerQ.includes('service account') || lowerQ.includes('bot') || lowerQ.includes('ci/cd')));

        if (matches) {
          subjectId = idNode.id;
          break;
        }
      }
    }

    // Default fallback to first identity or usr_nisha_patel if still not found
    if (!subjectId) {
      const defaultNode = this.graph.getNode('usr_nisha_patel');
      subjectId = defaultNode ? defaultNode.id : this.graph.getAllNodes().find((n) => n.type === 'Identity')?.id || 'usr_nisha_patel';
    }

    const subjectNode = this.graph.getNode(subjectId);
    const subjectName = subjectNode?.name || subjectId;

    // 2. Resolve target resource if not explicitly specified
    if (!targetId) {
      const allResources = this.graph
        .getAllNodes()
        .filter((n) => n.type === 'Repository' || n.type === 'CloudResource');

      // Sort by name length descending
      const sortedResources = [...allResources].sort((a, b) => b.name.length - a.name.length);

      for (const resNode of sortedResources) {
        const lowerResName = resNode.name.toLowerCase();
        const cleanName = lowerResName.replace(/^(repo_|cloud_|s3:\/\/|arn:[^/]+\/|rds:|kms\/)/, '');
        const idLower = resNode.id.toLowerCase();

        if (
          lowerQ.includes(lowerResName) ||
          lowerQ.includes(cleanName) ||
          lowerQ.includes(idLower) ||
          (lowerQ.includes('billing') && (lowerResName.includes('billing') || idLower.includes('billing'))) ||
          (lowerQ.includes('pii') && (lowerResName.includes('pii') || idLower.includes('pii'))) ||
          (lowerQ.includes('customer') && (lowerResName.includes('customer') || idLower.includes('customer'))) ||
          (lowerQ.includes('terraform') && (lowerResName.includes('terraform') || idLower.includes('infra'))) ||
          (lowerQ.includes('database') && (lowerResName.includes('db') || lowerResName.includes('aurora') || lowerResName.includes('postgres') || idLower.includes('rds'))) ||
          (lowerQ.includes('backup') && (lowerResName.includes('backup') || idLower.includes('backups'))) ||
          (lowerQ.includes('key') && (lowerResName.includes('key') || idLower.includes('kms')))
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
