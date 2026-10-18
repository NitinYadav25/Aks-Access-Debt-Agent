import { GraphNode, GraphEdge, RawEvidenceRecord } from './types';
import baseNodesData from '../../fixtures/graph_nodes.json';
import baseEdgesData from '../../fixtures/graph_edges.json';
import baseEvidenceData from '../../fixtures/evidence_records.json';

/**
 * Rich enterprise multi-cloud dataset representing a real high-growth tech company
 * (Acme Cloud Technologies) with multi-cloud assets across Okta, GitHub, and AWS IAM.
 * Preserves 100% of baseline benchmark fixtures while expanding with 20+ real enterprise nodes & edges.
 */
export function getEnterpriseDataset(): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: RawEvidenceRecord[];
} {
  const TENANT = 'tenant_demo_corp';
  const OBSERVED_NOW = '2026-10-10T14:30:00.000Z';

  // Start with baseline nodes, edges, and evidence
  const nodesMap = new Map<string, GraphNode>();
  for (const n of baseNodesData as unknown as GraphNode[]) {
    nodesMap.set(n.id, n);
  }

  const edgesMap = new Map<string, GraphEdge>();
  for (const e of baseEdgesData as unknown as GraphEdge[]) {
    edgesMap.set(e.id, e);
  }

  const evidenceMap = new Map<string, RawEvidenceRecord>();
  for (const ev of baseEvidenceData as unknown as RawEvidenceRecord[]) {
    evidenceMap.set(ev.id, ev);
  }

  // Enterprise additions
  const extraNodes: GraphNode[] = [
    // 1. Enterprise Leaders & SRE
    {
      id: 'usr_sarah_jenkins',
      type: 'Identity',
      name: 'Sarah Jenkins',
      tenant_id: TENANT,
      properties: {
        status: 'active',
        is_contractor: false,
        email: 'sarah.jenkins@acme.com',
        department: 'Site Reliability Engineering',
        title: 'Principal Cloud Architect & SRE Lead',
        last_login_at: OBSERVED_NOW,
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_usr_sarah_j',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'usr_carlos_mendez',
      type: 'Identity',
      name: 'Carlos Mendez',
      tenant_id: TENANT,
      properties: {
        status: 'active',
        is_contractor: false,
        email: 'carlos.mendez@acme.com',
        department: 'Infrastructure & DevOps',
        title: 'DevOps Engineer',
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_usr_carlos_m',
        observed_at: OBSERVED_NOW,
        confidence: 0.98,
      },
    },
    {
      id: 'usr_elena_rostova',
      type: 'Identity',
      name: 'Elena Rostova',
      tenant_id: TENANT,
      properties: {
        status: 'terminated',
        is_contractor: true,
        contract_end_date: '2026-08-15',
        email: 'elena.rostova.ext@acme.com',
        department: 'Design Systems',
        title: 'UI/UX Contract Developer',
      },
      provenance: {
        source_system: 'workday',
        source_record_id: 'wd_emp_elena_771',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'usr_priya_sharma',
      type: 'Identity',
      name: 'Priya Sharma',
      tenant_id: TENANT,
      properties: {
        status: 'active',
        is_contractor: false,
        email: 'priya.sharma@acme.com',
        department: 'Information Security',
        title: 'Head of Information Security',
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_usr_priya_s',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },

    // 2. Automated Service Principals (Access Debt Hotspot)
    {
      id: 'usr_sa_github_actions',
      type: 'Identity',
      name: 'GitHub Actions Deployer Bot',
      tenant_id: TENANT,
      properties: {
        status: 'active',
        is_service_account: true,
        email: 'bot-actions@acme.internal',
        department: 'Platform Automation',
        description: 'Automated CI/CD workflow runner with OIDC AWS assume role permissions',
      },
      provenance: {
        source_system: 'github',
        source_record_id: 'gh_app_actions_bot',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'usr_sa_terraform_cloud',
      type: 'Identity',
      name: 'Terraform Cloud Worker SA',
      tenant_id: TENANT,
      properties: {
        status: 'active',
        is_service_account: true,
        email: 'tfc-runner@acme.internal',
        department: 'Platform Automation',
        description: 'Runs weekly IAC configuration applies',
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_sa_tfc_runner',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },

    // 3. Additional Groups
    {
      id: 'grp_platform_sre',
      type: 'Group',
      name: 'platform-sre-team',
      tenant_id: TENANT,
      properties: {
        description: 'Senior platform and site reliability team with elevated infrastructure access',
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_grp_platform_sre',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'grp_security_team',
      type: 'Group',
      name: 'security-operations',
      tenant_id: TENANT,
      properties: {
        description: 'SecOps team with cross-account audit permissions',
      },
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_grp_secops',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },

    // 4. Additional Roles
    {
      id: 'role_cloud_admin',
      type: 'Role',
      name: 'aws-cloud-infrastructure-admin',
      tenant_id: TENANT,
      properties: {
        arn: 'arn:aws:iam::123456789012:role/AdministratorAccess',
        cloud_provider: 'aws',
        description: 'Elevated multi-region cluster and database administrator role',
      },
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'iam_role_admin',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },

    // 5. Additional Repositories & Cloud Resources
    {
      id: 'repo_infra_terraform',
      type: 'Repository',
      name: 'infra-terraform',
      tenant_id: TENANT,
      properties: {
        sensitivity_label: 'high',
        owner_id: 'usr_sarah_jenkins',
        cloud_provider: 'github',
        full_name: 'acme-corp/infra-terraform',
        topics: ['infrastructure', 'terraform', 'aws', 'eks'],
        private: true,
      },
      provenance: {
        source_system: 'github',
        source_record_id: 'gh_repo_infra_tf_12',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'repo_developer_docs',
      type: 'Repository',
      name: 'developer-docs',
      tenant_id: TENANT,
      properties: {
        sensitivity_label: 'low',
        owner_id: 'usr_alex_rivera',
        cloud_provider: 'github',
        full_name: 'acme-corp/developer-docs',
        topics: ['documentation', 'handbook'],
        private: false,
      },
      provenance: {
        source_system: 'github',
        source_record_id: 'gh_repo_docs_01',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'cloud_kms_billing_key',
      type: 'CloudResource',
      name: 'kms/billing-master-encryption-key',
      tenant_id: TENANT,
      properties: {
        arn: 'arn:aws:kms:us-east-1:123456789012:key/billing-master-key',
        sensitivity_label: 'high',
        cloud_provider: 'aws',
        resource_type: 'kms',
      },
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'aws_kms_billing_key',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'cloud_rds_aurora_cluster',
      type: 'CloudResource',
      name: 'rds:production-aurora-postgres-cluster',
      tenant_id: TENANT,
      properties: {
        arn: 'arn:aws:rds:us-east-1:123456789012:cluster:acme-prod-db',
        sensitivity_label: 'high',
        cloud_provider: 'aws',
        resource_type: 'rds',
      },
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'aws_rds_prod_db',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
  ];

  for (const n of extraNodes) {
    if (!nodesMap.has(n.id)) {
      nodesMap.set(n.id, n);
    }
  }

  // Extra Edges
  const extraEdges: GraphEdge[] = [
    {
      id: 'edge_sarah_in_platform_sre',
      source_id: 'usr_sarah_jenkins',
      target_id: 'grp_platform_sre',
      type: 'MEMBER_OF',
      provenance: {
        source_system: 'okta',
        source_record_id: 'okta_mem_sarah_sre',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_sre_assumes_cloud_admin',
      source_id: 'grp_platform_sre',
      target_id: 'role_cloud_admin',
      type: 'ASSUMES_ROLE',
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'iam_assume_sre_admin',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_cloud_admin_grants_infra_tf',
      source_id: 'role_cloud_admin',
      target_id: 'repo_infra_terraform',
      type: 'GRANTS_ACCESS',
      permission: 'admin',
      provenance: {
        source_system: 'github',
        source_record_id: 'gh_perm_admin_infra_tf',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_cloud_admin_grants_rds_db',
      source_id: 'role_cloud_admin',
      target_id: 'cloud_rds_aurora_cluster',
      type: 'GRANTS_ACCESS',
      permission: 'admin',
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'iam_grant_admin_rds',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_cloud_admin_grants_kms_billing',
      source_id: 'role_cloud_admin',
      target_id: 'cloud_kms_billing_key',
      type: 'GRANTS_ACCESS',
      permission: 'admin',
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'iam_grant_admin_kms',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_gh_actions_assumes_cloud_admin',
      source_id: 'usr_sa_github_actions',
      target_id: 'role_cloud_admin',
      type: 'ASSUMES_ROLE',
      provenance: {
        source_system: 'aws_iam',
        source_record_id: 'iam_oidc_gh_actions_admin',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
    {
      id: 'edge_elena_direct_docs',
      source_id: 'usr_elena_rostova',
      target_id: 'repo_developer_docs',
      type: 'GRANTS_ACCESS',
      permission: 'write',
      provenance: {
        source_system: 'github',
        source_record_id: 'gh_collab_elena_docs',
        observed_at: OBSERVED_NOW,
        confidence: 0.99,
      },
    },
  ];

  for (const e of extraEdges) {
    if (!edgesMap.has(e.id)) {
      edgesMap.set(e.id, e);
    }
  }

  // Extra Evidence
  const extraEvidence: RawEvidenceRecord[] = [
    {
      id: 'ev_okta_sarah_jenkins',
      source_system: 'okta',
      entity_type: 'User',
      external_id: 'okta_usr_sarah_j',
      payload: {
        user_id: 'usr_sarah_jenkins',
        email: 'sarah.jenkins@acme.com',
        status: 'active',
        groups: ['platform-sre-team'],
        mfa_enforced: true,
      },
      observed_at: OBSERVED_NOW,
      synced_at: OBSERVED_NOW,
    },
    {
      id: 'ev_gh_app_actions_bot',
      source_system: 'github',
      entity_type: 'ServiceAccount',
      external_id: 'gh_app_actions_bot',
      payload: {
        user_id: 'usr_sa_github_actions',
        type: 'bot',
        permissions: ['assume_role', 'oidc'],
      },
      observed_at: OBSERVED_NOW,
      synced_at: OBSERVED_NOW,
    },
  ];

  for (const ev of extraEvidence) {
    if (!evidenceMap.has(ev.id)) {
      evidenceMap.set(ev.id, ev);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    evidence: Array.from(evidenceMap.values()),
  };
}
