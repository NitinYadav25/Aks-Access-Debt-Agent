import { PriorityScore, AccessPath, GraphNode } from '../core/types';

export class ExplainablePriorityCalculator {
  /**
   * Compute rules-based explainable risk score and contributing factors (FR-5).
   * Note: "High" must not be interpreted as confirmed compromise.
   */
  public calculatePriority(
    path?: AccessPath,
    subjectNode?: GraphNode,
    targetNode?: GraphNode
  ): PriorityScore {
    const factors: PriorityScore['factors'] = [];
    let totalScore = 0;

    if (!path || !subjectNode || !targetNode) {
      return {
        level: 'LOW',
        score: 0,
        factors: [
          {
            factor: 'No active access path',
            points: 0,
            description: 'No reachability identified to sensitive assets.',
          },
        ],
      };
    }

    // 1. Target Resource Sensitivity Factor
    const sensitivity = targetNode.properties.sensitivity_label;
    if (sensitivity === 'high') {
      totalScore += 35;
      factors.push({
        factor: 'High-Sensitivity Resource',
        points: 35,
        description: `Target resource '${targetNode.name}' has 'high' sensitivity (e.g. PCI-DSS, Customer PII, Production DB).`,
      });
    } else if (sensitivity === 'medium') {
      totalScore += 20;
      factors.push({
        factor: 'Medium-Sensitivity Resource',
        points: 20,
        description: `Target resource '${targetNode.name}' has 'medium' sensitivity.`,
      });
    } else {
      totalScore += 5;
      factors.push({
        factor: 'Standard Resource',
        points: 5,
        description: `Target resource '${targetNode.name}' has standard/low sensitivity.`,
      });
    }

    // 2. Identity Employment Status & Dormancy
    const status = subjectNode.properties.status;
    const isContractor = subjectNode.properties.is_contractor;

    if (status === 'terminated') {
      totalScore += 30;
      const contractEnd = subjectNode.properties.contract_end_date
        ? ` (contract ended ${subjectNode.properties.contract_end_date.split('T')[0]})`
        : '';
      factors.push({
        factor: 'Departed / Terminated Identity',
        points: 30,
        description: `Identity '${subjectNode.name}' is departed${contractEnd} but retains active access paths.`,
      });
    } else if (status === 'dormant') {
      totalScore += 15;
      factors.push({
        factor: 'Dormant Account',
        points: 15,
        description: `Identity '${subjectNode.name}' is flagged as dormant with no recent sign-in activity.`,
      });
    } else if (isContractor) {
      totalScore += 10;
      factors.push({
        factor: 'External Contractor Role',
        points: 10,
        description: `Identity '${subjectNode.name}' belongs to an external vendor/contractor organization.`,
      });
    }

    // 3. Indirect Multi-Hop Inheritance (Access Debt)
    if (path.hop_count >= 3) {
      totalScore += 15;
      factors.push({
        factor: 'Multi-Hop Access Debt',
        points: 15,
        description: `Access path spans ${path.hop_count} indirect hops through nested groups and assumed roles.`,
      });
    } else if (path.hop_count === 2) {
      totalScore += 10;
      factors.push({
        factor: 'Group-Inherited Access',
        points: 10,
        description: 'Access is granted via single-level group membership.',
      });
    }

    // 4. Privilege Level along Path
    const hasAdminEdge = path.edges.some((e) => e.permission === 'admin');
    const hasWriteEdge = path.edges.some((e) => e.permission === 'write');
    if (hasAdminEdge) {
      totalScore += 20;
      factors.push({
        factor: 'Administrative Privileges',
        points: 20,
        description: 'Path confers administrative / full management permissions.',
      });
    } else if (hasWriteEdge) {
      totalScore += 15;
      factors.push({
        factor: 'Write / Modify Privileges',
        points: 15,
        description: 'Path confers write or state-altering access to the repository/resource.',
      });
    } else {
      totalScore += 10;
      factors.push({
        factor: 'Read-Only Privileges',
        points: 10,
        description: 'Path confers read access to confidential source code or data.',
      });
    }

    // Normalize score to max 100
    const clampedScore = Math.min(100, Math.max(0, totalScore));

    let level: PriorityScore['level'] = 'LOW';
    if (clampedScore >= 75) {
      level = 'CRITICAL';
    } else if (clampedScore >= 50) {
      level = 'HIGH';
    } else if (clampedScore >= 25) {
      level = 'MEDIUM';
    }

    return {
      level,
      score: clampedScore,
      factors,
    };
  }
}
