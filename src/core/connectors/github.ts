import { GraphNode, GraphEdge, RawEvidenceRecord, SensitivityLabel } from '../types';
import { GitHubOrgExport, ConnectorParseResult } from './types';

/**
 * Ingests real GitHub Organization export and maps it to canonical Access Graph entities.
 */
export function parseGitHubOrgExport(
  data: GitHubOrgExport,
  tenantId: string = 'tenant_demo_corp'
): ConnectorParseResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const evidence: RawEvidenceRecord[] = [];
  const observedAt = data.exported_at || new Date().toISOString();

  // 1. Process Members
  for (const member of data.members) {
    const nodeId = `usr_${member.login.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const isContractor = member.role === 'collaborator' || member.login.includes('contractor') || member.department === 'Contractors';

    nodes.push({
      id: nodeId,
      type: 'Identity',
      name: member.name || member.login,
      tenant_id: tenantId,
      properties: {
        status: member.suspended ? 'terminated' : 'active',
        is_contractor: isContractor,
        email: member.email || `${member.login}@acme.com`,
        department: member.department || 'Engineering',
        cloud_provider: 'github',
        github_login: member.login,
        two_factor_auth: member.two_factor_auth,
      },
      provenance: {
        source_system: 'github',
        source_record_id: `gh_member_${member.login}`,
        observed_at: observedAt,
        confidence: 0.98,
      },
    });

    evidence.push({
      id: `ev_gh_member_${member.login}`,
      record_id: `ev_gh_member_${member.login}`,
      source_system: 'github',
      entity_id: nodeId,
      entity_type: 'Identity',
      observed_at: observedAt,
      ttl_days: 14,
      payload: {
        login: member.login,
        role: member.role,
        suspended: member.suspended,
        org: data.org,
      },
    });
  }

  // 2. Process Teams
  for (const team of data.teams) {
    const teamNodeId = `grp_github_${team.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    nodes.push({
      id: teamNodeId,
      type: 'Group',
      name: team.name,
      tenant_id: tenantId,
      properties: {
        slug: team.slug,
        description: team.description || `GitHub Team ${team.name}`,
        cloud_provider: 'github',
      },
      provenance: {
        source_system: 'github',
        source_record_id: `gh_team_${team.slug}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });

    // Team members -> MEMBER_OF
    for (const memberLogin of team.members) {
      const userNodeId = `usr_${memberLogin.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const edgeId = `edge_${userNodeId}_in_${teamNodeId}`;

      edges.push({
        id: edgeId,
        source_id: userNodeId,
        target_id: teamNodeId,
        type: 'MEMBER_OF',
        provenance: {
          source_system: 'github',
          source_record_id: `gh_membership_${team.slug}_${memberLogin}`,
          observed_at: observedAt,
          confidence: 0.99,
        },
      });
    }

    // Parent team -> NESTED_IN
    if (team.parent_slug) {
      const parentTeamNodeId = `grp_github_${team.parent_slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const edgeId = `edge_${teamNodeId}_nested_in_${parentTeamNodeId}`;

      edges.push({
        id: edgeId,
        source_id: teamNodeId,
        target_id: parentTeamNodeId,
        type: 'NESTED_IN',
        provenance: {
          source_system: 'github',
          source_record_id: `gh_team_nesting_${team.slug}_${team.parent_slug}`,
          observed_at: observedAt,
          confidence: 0.99,
        },
      });
    }
  }

  // 3. Process Repositories
  for (const repo of data.repositories) {
    const repoNodeId = `repo_${repo.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Determine sensitivity label based on topics and name
    let sensitivity: SensitivityLabel = 'low';
    const lowerName = repo.name.toLowerCase();
    const isSensitive =
      lowerName.includes('billing') ||
      lowerName.includes('auth') ||
      lowerName.includes('payment') ||
      lowerName.includes('pii') ||
      lowerName.includes('vault') ||
      lowerName.includes('infra') ||
      lowerName.includes('secret') ||
      repo.topics?.some((t) => ['security', 'compliance', 'financial', 'pii'].includes(t.toLowerCase()));

    if (isSensitive) {
      sensitivity = 'high';
    } else if (repo.private) {
      sensitivity = 'medium';
    }

    nodes.push({
      id: repoNodeId,
      type: 'Repository',
      name: repo.name,
      tenant_id: tenantId,
      properties: {
        sensitivity_label: sensitivity,
        owner_id: repo.owner,
        cloud_provider: 'github',
        full_name: repo.full_name,
        private: repo.private,
        visibility: repo.visibility,
        topics: repo.topics,
      },
      provenance: {
        source_system: 'github',
        source_record_id: `gh_repo_${repo.name}`,
        observed_at: observedAt,
        confidence: 0.99,
      },
    });

    // Team repository permissions -> GRANTS_ACCESS
    if (repo.team_permissions) {
      for (const [teamSlug, perm] of Object.entries(repo.team_permissions)) {
        const teamNodeId = `grp_github_${teamSlug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const edgeId = `edge_${teamNodeId}_grants_${repoNodeId}`;

        edges.push({
          id: edgeId,
          source_id: teamNodeId,
          target_id: repoNodeId,
          type: 'GRANTS_ACCESS',
          permission: perm,
          provenance: {
            source_system: 'github',
            source_record_id: `gh_repo_perm_${teamSlug}_${repo.name}`,
            observed_at: observedAt,
            confidence: 0.99,
          },
        });
      }
    }

    // Direct collaborator permissions -> GRANTS_ACCESS
    if (repo.direct_collaborators) {
      for (const [userLogin, perm] of Object.entries(repo.direct_collaborators)) {
        const userNodeId = `usr_${userLogin.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const edgeId = `edge_${userNodeId}_direct_${repoNodeId}`;

        edges.push({
          id: edgeId,
          source_id: userNodeId,
          target_id: repoNodeId,
          type: 'GRANTS_ACCESS',
          permission: perm,
          provenance: {
            source_system: 'github',
            source_record_id: `gh_direct_collab_${userLogin}_${repo.name}`,
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
      source: 'github',
      nodesCount: nodes.length,
      edgesCount: edges.length,
      evidenceCount: evidence.length,
    },
  };
}
