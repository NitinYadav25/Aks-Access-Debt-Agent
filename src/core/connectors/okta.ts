import { GraphNode, GraphEdge, RawEvidenceRecord } from '../types';
import { OktaExport, ConnectorParseResult } from './types';

/**
 * Ingests real Okta SSO / Workday HRIS export and maps to canonical Access Graph entities.
 */
export function parseOktaExport(
  data: OktaExport,
  tenantId: string = 'tenant_demo_corp'
): ConnectorParseResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const evidence: RawEvidenceRecord[] = [];
  const observedAt = data.exportedAt || new Date().toISOString();

  // 1. Process Groups
  for (const group of data.groups) {
    const groupNodeId = `grp_okta_${group.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    nodes.push({
      id: groupNodeId,
      type: 'Group',
      name: group.profile.name,
      tenant_id: tenantId,
      properties: {
        description: group.profile.description || `Okta Group ${group.profile.name}`,
        okta_id: group.id,
      },
      provenance: {
        source_system: 'okta',
        source_record_id: `okta_group_${group.id}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });
  }

  // 2. Process Users
  for (const user of data.users) {
    const userNodeId = `usr_${user.profile.login.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const isContractor = user.profile.userType === 'CONTRACTOR' || Boolean(user.profile.contractEndDate);
    const statusMap = {
      ACTIVE: 'active',
      SUSPENDED: 'terminated',
      DEPROVISIONED: 'terminated',
      STAGED: 'dormant',
    } as const;

    nodes.push({
      id: userNodeId,
      type: 'Identity',
      name: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
      tenant_id: tenantId,
      properties: {
        status: statusMap[user.status] || 'active',
        is_contractor: isContractor,
        contract_end_date: user.profile.contractEndDate,
        email: user.profile.email,
        department: user.profile.department,
        last_login_at: user.lastLogin,
        user_type: user.profile.userType,
      },
      provenance: {
        source_system: 'okta',
        source_record_id: `okta_user_${user.id}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });

    evidence.push({
      id: `ev_okta_user_${user.id}`,
      record_id: `ev_okta_user_${user.id}`,
      source_system: 'okta',
      entity_id: userNodeId,
      entity_type: 'Identity',
      observed_at: observedAt,
      ttl_days: 14,
      payload: {
        id: user.id,
        login: user.profile.login,
        status: user.status.toLowerCase(),
        last_login: user.lastLogin,
      },
    });

    // Group memberships
    for (const groupId of user.groupIds) {
      const group = data.groups.find((g) => g.id === groupId);
      if (group) {
        const groupNodeId = `grp_okta_${group.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const edgeId = `edge_${userNodeId}_in_${groupNodeId}`;

        edges.push({
          id: edgeId,
          source_id: userNodeId,
          target_id: groupNodeId,
          type: 'MEMBER_OF',
          provenance: {
            source_system: 'okta',
            source_record_id: `okta_member_${groupId}_${user.id}`,
            observed_at: observedAt,
            confidence: 0.99,
          },
        });
      }
    }
  }

  return {
    nodes,
    edges,
    evidence,
    summary: {
      source: 'okta',
      nodesCount: nodes.length,
      edgesCount: edges.length,
      evidenceCount: evidence.length,
    },
  };
}
