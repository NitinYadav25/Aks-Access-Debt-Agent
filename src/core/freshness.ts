import { AccessPath, FreshnessEvaluation, GraphNode, RawEvidenceRecord } from './types';

export interface FreshnessCheckOptions {
  referenceDate?: Date;
  maxAgeDays?: number; // Default: 30 days
}

export class FreshnessEvaluator {
  private referenceDate: Date;
  private maxAgeDays: number;

  constructor(options: FreshnessCheckOptions = {}) {
    this.referenceDate = options.referenceDate ?? new Date('2026-10-10T00:00:00.000Z');
    this.maxAgeDays = options.maxAgeDays ?? 30;
  }

  /**
   * Evaluate freshness of all nodes and edges in a specific access path.
   */
  public evaluatePathFreshness(
    path: AccessPath,
    rawEvidence: RawEvidenceRecord[] = []
  ): FreshnessEvaluation {
    const staleRecords: FreshnessEvaluation['stale_records'] = [];
    const conflicts: FreshnessEvaluation['conflicts'] = [];

    // 1. Check age of nodes
    for (const node of path.nodes) {
      const observedDate = new Date(node.provenance.observed_at);
      const ageDays = this.calculateAgeDays(observedDate);

      if (ageDays > this.maxAgeDays) {
        staleRecords.push({
          entity_id: node.id,
          source_system: node.provenance.source_system,
          observed_at: node.provenance.observed_at,
          age_days: Math.round(ageDays),
        });
      }
    }

    // 2. Check age of edges
    for (const edge of path.edges) {
      const observedDate = new Date(edge.provenance.observed_at);
      const ageDays = this.calculateAgeDays(observedDate);

      if (ageDays > this.maxAgeDays) {
        staleRecords.push({
          entity_id: edge.id,
          source_system: edge.provenance.source_system,
          observed_at: edge.provenance.observed_at,
          age_days: Math.round(ageDays),
        });
      }
    }

    // 3. Check for conflicting source records for the path's subject
    const subjectNode = path.nodes[0];
    if (subjectNode) {
      const subjectEvidence = rawEvidence.filter(
        (e) => e.payload?.user_id === subjectNode.id || e.payload?.email === subjectNode.properties.email
      );

      // Check if one source says terminated and another says active
      const workdayRecord = subjectEvidence.find((e) => e.source_system === 'workday');
      const oktaRecord = subjectEvidence.find((e) => e.source_system === 'okta');

      if (workdayRecord && oktaRecord) {
        const workdayStatus = workdayRecord.payload.status;
        const oktaStatus = oktaRecord.payload.status;

        const isInactive = (s: unknown) => s === 'terminated' || s === 'suspended' || s === 'deprovisioned';
        const isActive = (s: unknown) => s === 'active';
        const isStatusConflict =
          (isActive(workdayStatus) && isInactive(oktaStatus)) ||
          (isInactive(workdayStatus) && isActive(oktaStatus));

        if (isStatusConflict) {
          conflicts.push({
            entity_id: subjectNode.id,
            field: 'status',
            source_a: {
              system: 'workday',
              value: workdayStatus,
              observed_at: workdayRecord.observed_at,
            },
            source_b: {
              system: 'okta',
              value: oktaStatus,
              observed_at: oktaRecord.observed_at,
            },
            reason: `Workday reports status '${workdayStatus}' but Okta reports '${oktaStatus}'`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      return {
        verdict: 'CONFLICT',
        is_acceptable: false,
        max_age_days: this.maxAgeDays,
        stale_records: staleRecords,
        conflicts,
        summary: `Conflicting source records detected for ${conflicts.map((c) => c.entity_id).join(', ')}. Automated remediation must be blocked until sources are verified.`,
      };
    }

    if (staleRecords.length > 0) {
      return {
        verdict: 'STALE',
        is_acceptable: false,
        max_age_days: this.maxAgeDays,
        stale_records: staleRecords,
        conflicts: [],
        summary: `Observed data exceeds freshness threshold (${this.maxAgeDays} days) for ${staleRecords.length} entities/edges. Verify source before proceeding.`,
      };
    }

    return {
      verdict: 'FRESH',
      is_acceptable: true,
      max_age_days: this.maxAgeDays,
      stale_records: [],
      conflicts: [],
      summary: 'All graph entities and relationships are within acceptable freshness limits (≤ 30 days).',
    };
  }

  /**
   * Evaluate a single node for standalone queries (e.g., when no path exists).
   */
  public evaluateNodeFreshness(node: GraphNode): FreshnessEvaluation {
    const observedDate = new Date(node.provenance.observed_at);
    const ageDays = this.calculateAgeDays(observedDate);

    if (ageDays > this.maxAgeDays) {
      return {
        verdict: 'STALE',
        is_acceptable: false,
        max_age_days: this.maxAgeDays,
        stale_records: [
          {
            entity_id: node.id,
            source_system: node.provenance.source_system,
            observed_at: node.provenance.observed_at,
            age_days: Math.round(ageDays),
          },
        ],
        conflicts: [],
        summary: `Entity ${node.name} observed data is ${Math.round(ageDays)} days old (limit: ${this.maxAgeDays} days).`,
      };
    }

    return {
      verdict: 'FRESH',
      is_acceptable: true,
      max_age_days: this.maxAgeDays,
      stale_records: [],
      conflicts: [],
      summary: `Entity ${node.name} data is fresh (${Math.round(ageDays)} days old).`,
    };
  }

  private calculateAgeDays(date: Date): number {
    const diffMs = this.referenceDate.getTime() - date.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  }
}
