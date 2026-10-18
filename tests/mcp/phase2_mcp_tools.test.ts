import { describe, it, expect, beforeEach } from 'vitest';
import { loadSyntheticFixtures } from '../../src/core/loader';
import { AksMcpServer } from '../../src/mcp/server';
import { AksMcpClient } from '../../src/mcp/client';

describe('Aks Phase 2: MCP Server & Tool Layer Protocol Tests', () => {
  let fixtures: ReturnType<typeof loadSyntheticFixtures>;
  let server: AksMcpServer;
  let client: AksMcpClient;

  beforeEach(async () => {
    fixtures = loadSyntheticFixtures();
    server = new AksMcpServer({
      graph: fixtures.graph,
      rawEvidence: fixtures.rawEvidence,
    });
    client = new AksMcpClient(server);
    await client.connect();
  });

  describe('MCP Dynamic Tool Discovery (tools/list)', () => {
    it('discovers all five required tools with correct schemas', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toHaveLength(6);
      expect(toolNames).toContain('get_graph_schema');
      expect(toolNames).toContain('find_access_paths');
      expect(toolNames).toContain('get_entity_evidence');
      expect(toolNames).toContain('simulate_edge_removal');
      expect(toolNames).toContain('create_remediation_draft');
      expect(toolNames).toContain('falkordb_cypher_query');

      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('Tool 1: get_graph_schema', () => {
    it('returns canonical graph schema and allowed relationship directions', async () => {
      interface SchemaResult {
        schema: {
          nodeTypes: string[];
          edgeTypes: string[];
          totalNodes: number;
          totalEdges: number;
          tenantBoundary: string;
        };
        allowedRelationshipDirections: string[];
      }

      const result = await client.callTool<SchemaResult>('get_graph_schema', {
        tenant_id: 'tenant_demo_corp',
      });

      expect(result.schema.tenantBoundary).toBe('tenant_demo_corp');
      expect(result.schema.nodeTypes).toContain('Identity');
      expect(result.schema.edgeTypes).toContain('MEMBER_OF');
      expect(result.allowedRelationshipDirections.length).toBeGreaterThan(0);
    });

    it('rejects query for unauthorized or mismatched tenant boundary', async () => {
      await expect(
        client.callTool('get_graph_schema', { tenant_id: 'unauthorized_tenant_xyz' })
      ).rejects.toThrow(/Tenant 'unauthorized_tenant_xyz' not found/);
    });
  });

  describe('Tool 2: find_access_paths', () => {
    it('discovers multi-hop access paths from departed contractor to billing-api', async () => {
      interface FindPathsResult {
        source_id: string;
        total_paths_found: number;
        paths: {
          path_id: string;
          hop_count: number;
          nodes: { id: string; name: string }[];
          edges: { id: string; type: string }[];
        }[];
      }

      const result = await client.callTool<FindPathsResult>('find_access_paths', {
        source_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
        max_hops: 6,
      });

      expect(result.total_paths_found).toBe(1);
      const path = result.paths[0];
      expect(path.hop_count).toBe(4);
      expect(path.nodes[0].id).toBe('usr_nisha_patel');
      expect(path.nodes[path.nodes.length - 1].id).toBe('repo_billing_api');
    });

    it('enforces validation schema and rejects invalid hop count', async () => {
      await expect(
        client.callTool('find_access_paths', {
          source_id: 'usr_nisha_patel',
          max_hops: 10, // Max allowed is 6
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool 3: get_entity_evidence', () => {
    it('fetches source records, timestamps, and provenance for nodes and edges', async () => {
      interface EvidenceResult {
        requested_count: number;
        found_count: number;
        entities: { id: string; kind: string; provenance: { source_system: string } }[];
        raw_source_records: { source_system: string; payload: Record<string, unknown> }[];
        freshness: { entity_id: string; age_days: number; is_stale: boolean }[];
      }

      const result = await client.callTool<EvidenceResult>('get_entity_evidence', {
        entity_ids: ['usr_nisha_patel', 'edge_nisha_contractors', 'repo_billing_api'],
      });

      expect(result.found_count).toBe(3);
      expect(result.raw_source_records.length).toBeGreaterThan(0);
      expect(result.freshness.length).toBe(3);

      const nishaFreshness = result.freshness.find((f) => f.entity_id === 'usr_nisha_patel');
      expect(nishaFreshness).toBeDefined();
    });
  });

  describe('Tool 4: simulate_edge_removal', () => {
    it('simulates removal of minimal edge and confirms safe remediation with peer retention', async () => {
      interface SimResult {
        candidate_edge_id: string;
        risky_path_broken: boolean;
        identity_remaining_paths_count: number;
        peer_impact: { peer_id: string; retains_access: boolean }[];
        is_safe_remediation: boolean;
        explanation: string;
      }

      const result = await client.callTool<SimResult>('simulate_edge_removal', {
        candidate_edge_id: 'edge_nisha_contractors',
        source_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
        peer_identity_ids: ['usr_alex_rivera'],
      });

      expect(result.candidate_edge_id).toBe('edge_nisha_contractors');
      expect(result.risky_path_broken).toBe(true);
      expect(result.identity_remaining_paths_count).toBe(0);
      expect(result.is_safe_remediation).toBe(true);
      expect(result.peer_impact[0].retains_access).toBe(true);
      expect(result.explanation).toContain('closes the access path');
    });

    it('flags broad edge removal as unsafe when peer access is broken', async () => {
      interface SimResult {
        is_safe_remediation: boolean;
        peer_impact: { retains_access: boolean }[];
      }

      const result = await client.callTool<SimResult>('simulate_edge_removal', {
        candidate_edge_id: 'edge_reader_billing',
        source_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
        peer_identity_ids: ['usr_alex_rivera'],
      });

      expect(result.is_safe_remediation).toBe(false);
      expect(result.peer_impact[0].retains_access).toBe(false);
    });
  });

  describe('Tool 5: create_remediation_draft', () => {
    it('creates a mock pull request draft clearly marked [DRAFT ONLY]', async () => {
      interface DraftResult {
        draft_id: string;
        idempotency_key: string;
        status: string;
        draft_type: string;
        title: string;
        body_markdown: string;
        rollback_instructions: string;
        disclaimer: string;
      }

      const result = await client.callTool<DraftResult>('create_remediation_draft', {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: "Remove user 'Nisha Patel' from group 'contractors-dev'",
        rationale: 'Terminated contractor retains indirect read access to billing-api.',
        affected_identity: 'usr_nisha_patel',
        affected_resource: 'repo_billing_api',
        rollback_hint: "Re-assign user 'Nisha Patel' to group 'contractors-dev'",
        idempotency_key: 'idemp_key_test_001',
        draft_type: 'github_pr',
      });

      expect(result.status).toBe('DRAFT_ONLY');
      expect(result.title).toContain('[DRAFT ONLY]');
      expect(result.body_markdown).toContain('NO PERMISSIONS HAVE BEEN MUTATED');
      expect(result.disclaimer).toContain('DRAFT ONLY');
      expect(result.rollback_instructions).toContain('Re-assign user');
    });

    it('enforces idempotency on duplicate draft requests', async () => {
      interface DraftResult {
        draft_id: string;
        idempotency_key: string;
      }

      const draft1 = await client.callTool<DraftResult>('create_remediation_draft', {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: 'Action 1',
        rationale: 'Rationale 1',
        affected_identity: 'usr_nisha_patel',
        affected_resource: 'repo_billing_api',
        rollback_hint: 'Rollback 1',
        idempotency_key: 'idemp_duplicate_check_99',
      });

      const draft2 = await client.callTool<DraftResult>('create_remediation_draft', {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: 'Action 2 (Ignored)',
        rationale: 'Rationale 2 (Ignored)',
        affected_identity: 'usr_nisha_patel',
        affected_resource: 'repo_billing_api',
        rollback_hint: 'Rollback 2',
        idempotency_key: 'idemp_duplicate_check_99',
      });

      expect(draft1.draft_id).toBe(draft2.draft_id);
    });
  });

  describe('MCP Audit Logging & Scope Separation', () => {
    it('logs every tool call with scope, duration, status, and sanitized input', async () => {
      await client.callTool('get_graph_schema', {});
      await client.callTool('create_remediation_draft', {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: 'Action',
        rationale: 'Rationale',
        affected_identity: 'usr_nisha_patel',
        affected_resource: 'repo_billing_api',
        rollback_hint: 'Rollback',
        idempotency_key: 'idemp_audit_test',
        secret: 'super-secret-token', // should be sanitized
      });

      const logs = client.getAuditLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);

      const readLog = logs.find((l) => l.tool_name === 'get_graph_schema');
      expect(readLog).toBeDefined();
      expect(readLog?.scope).toBe('read');
      expect(readLog?.status).toBe('success');
      expect(readLog?.duration_ms).toBeGreaterThanOrEqual(0);

      const writeLog = logs.find((l) => l.tool_name === 'create_remediation_draft');
      expect(writeLog).toBeDefined();
      expect(writeLog?.scope).toBe('write');
      expect(writeLog?.sanitized_input.secret).toBeUndefined(); // Verified sanitized!
    });
  });
});
