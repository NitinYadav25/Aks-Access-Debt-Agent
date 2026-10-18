import { GraphNode, GraphEdge, RawEvidenceRecord, SensitivityLabel } from '../types';
import { AwsIamExport, ConnectorParseResult } from './types';

/**
 * Ingests real AWS IAM export (Roles, AssumeRole policies, IAM Users, and Cloud Resources)
 * and maps them to canonical Access Graph entities.
 */
export function parseAwsIamExport(
  data: AwsIamExport,
  tenantId: string = 'tenant_demo_corp'
): ConnectorParseResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const evidence: RawEvidenceRecord[] = [];
  const observedAt = data.ExportedAt || new Date().toISOString();

  // 1. Process IAM Users
  for (const user of data.Users) {
    const userNodeId = `usr_${user.UserName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    nodes.push({
      id: userNodeId,
      type: 'Identity',
      name: user.UserName,
      tenant_id: tenantId,
      properties: {
        status: 'active',
        arn: user.Arn,
        cloud_provider: 'aws',
        last_login_at: user.PasswordLastUsed,
      },
      provenance: {
        source_system: 'aws_iam',
        source_record_id: `iam_user_${user.UserId}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });

    // IAM User Groups -> MEMBER_OF
    for (const groupName of user.Groups) {
      const groupNodeId = `grp_aws_${groupName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const edgeId = `edge_${userNodeId}_in_${groupNodeId}`;

      edges.push({
        id: edgeId,
        source_id: userNodeId,
        target_id: groupNodeId,
        type: 'MEMBER_OF',
        provenance: {
          source_system: 'aws_iam',
          source_record_id: `iam_user_group_${user.UserName}_${groupName}`,
          observed_at: observedAt,
          confidence: 0.99,
        },
      });
    }
  }

  // 2. Process IAM Roles
  for (const role of data.Roles) {
    const roleNodeId = `role_${role.RoleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    nodes.push({
      id: roleNodeId,
      type: 'Role',
      name: role.RoleName,
      tenant_id: tenantId,
      properties: {
        arn: role.Arn,
        cloud_provider: 'aws',
        account_id: data.AccountId,
      },
      provenance: {
        source_system: 'aws_iam',
        source_record_id: `iam_role_${role.RoleId}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });

    evidence.push({
      id: `ev_iam_role_${role.RoleName}`,
      record_id: `ev_iam_role_${role.RoleName}`,
      source_system: 'aws_iam',
      entity_id: roleNodeId,
      entity_type: 'Role',
      observed_at: observedAt,
      ttl_days: 30,
      payload: {
        arn: role.Arn,
        assume_role_policy: role.AssumeRolePolicyDocument,
        attached_policies: role.AttachedPolicies,
      },
    });

    // AssumeRole Statements -> ASSUMES_ROLE edges
    for (const stmt of role.AssumeRolePolicyDocument?.Statement || []) {
      if (stmt.Effect === 'Allow') {
        const principals = stmt.Principal?.AWS;
        const principalList = Array.isArray(principals) ? principals : principals ? [principals] : [];

        for (const p of principalList) {
          // If principal is an IAM user or role or group
          const cleanName = p.split('/').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'unknown';
          const sourcePrincipalId = p.includes(':role/') ? `role_${cleanName}` : `usr_${cleanName}`;
          const edgeId = `edge_${sourcePrincipalId}_assumes_${roleNodeId}`;

          edges.push({
            id: edgeId,
            source_id: sourcePrincipalId,
            target_id: roleNodeId,
            type: 'ASSUMES_ROLE',
            provenance: {
              source_system: 'aws_iam',
              source_record_id: `iam_assume_${cleanName}_${role.RoleName}`,
              observed_at: observedAt,
              confidence: 0.99,
            },
          });
        }
      }
    }

    // Direct Resource Grants -> CloudResource nodes & GRANTS_ACCESS edges
    for (const grant of role.DirectResourceGrants || []) {
      const resName = grant.ResourceArn.split('/').pop() || grant.ResourceArn.split(':').pop() || 'resource';
      const resNodeId = `cloud_${grant.ResourceType}_${resName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Add resource node if not already added
      if (!nodes.some((n) => n.id === resNodeId)) {
        nodes.push({
          id: resNodeId,
          type: 'CloudResource',
          name: resName,
          tenant_id: tenantId,
          properties: {
            arn: grant.ResourceArn,
            sensitivity_label: grant.Sensitivity as SensitivityLabel,
            cloud_provider: 'aws',
            resource_type: grant.ResourceType,
          },
          provenance: {
            source_system: 'aws_iam',
            source_record_id: `aws_resource_${grant.ResourceArn}`,
            observed_at: observedAt,
            confidence: 0.99,
          },
        });
      }

      // Role -> CloudResource GRANTS_ACCESS edge
      const edgeId = `edge_${roleNodeId}_grants_${resNodeId}`;
      edges.push({
        id: edgeId,
        source_id: roleNodeId,
        target_id: resNodeId,
        type: 'GRANTS_ACCESS',
        permission: grant.Permission,
        provenance: {
          source_system: 'aws_iam',
          source_record_id: `iam_grant_${role.RoleName}_${resName}`,
          observed_at: observedAt,
          confidence: 0.99,
        },
      });
    }
  }

  return {
    nodes,
    edges,
    evidence,
    summary: {
      source: 'aws_iam',
      nodesCount: nodes.length,
      edgesCount: edges.length,
      evidenceCount: evidence.length,
    },
  };
}
