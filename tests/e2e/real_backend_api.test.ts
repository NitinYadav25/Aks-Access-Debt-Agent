import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as handleStats } from '../../src/app/api/graph/stats/route';
import { GET as handleNodes } from '../../src/app/api/graph/nodes/route';
import { GET as handleEdges } from '../../src/app/api/graph/edges/route';
import { POST as handleIngest } from '../../src/app/api/graph/ingest/route';
import { POST as handleSample } from '../../src/app/api/graph/sample/route';
import { GET as handleDraftsGet, PATCH as handleDraftsPatch } from '../../src/app/api/drafts/route';
import { GET as handleAudit } from '../../src/app/api/audit/route';
import { POST as handleSimulate } from '../../src/app/api/simulate/route';
import { POST as handleCreateDraft } from '../../src/app/api/draft/route';

function createRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Real Backend REST API Suite', () => {
  it('GET /api/graph/stats returns comprehensive multi-cloud graph metrics', async () => {
    const res = await handleStats();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.totalNodes).toBeGreaterThanOrEqual(15);
    expect(data.totalEdges).toBeGreaterThanOrEqual(10);
    expect(data.identitiesCount).toBeGreaterThan(0);
    expect(data.repositoriesCount).toBeGreaterThan(0);
    expect(data.systemsBreakdown).toBeDefined();
    expect(data.systemsBreakdown.github).toBeGreaterThan(0);
    expect(data.systemsBreakdown.aws_iam).toBeGreaterThan(0);
    expect(data.systemsBreakdown.okta).toBeGreaterThan(0);
  });

  it('GET /api/graph/nodes supports filtering and search', async () => {
    const reqAll = createRequest('/api/graph/nodes', 'GET');
    const resAll = await handleNodes(reqAll);
    expect(resAll.status).toBe(200);
    const dataAll = await resAll.json();
    expect(dataAll.total).toBeGreaterThanOrEqual(15);

    // Filter by type=Identity
    const reqId = createRequest('/api/graph/nodes?type=Identity', 'GET');
    const resId = await handleNodes(reqId);
    const dataId = await resId.json();
    expect(dataId.nodes.every((n: any) => n.type === 'Identity')).toBe(true);

    // Search by name=Sarah
    const reqSearch = createRequest('/api/graph/nodes?q=sarah', 'GET');
    const resSearch = await handleNodes(reqSearch);
    const dataSearch = await resSearch.json();
    expect(dataSearch.total).toBeGreaterThanOrEqual(1);
    expect(dataSearch.nodes[0].name).toContain('Sarah');
  });

  it('GET /api/graph/edges returns enriched edges with source and target details', async () => {
    const req = createRequest('/api/graph/edges', 'GET');
    const res = await handleEdges(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(10);
    expect(data.edges[0].source_name).toBeDefined();
    expect(data.edges[0].target_name).toBeDefined();
  });

  it('POST /api/graph/ingest merges custom nodes and edges into active graph', async () => {
    const customPayload = {
      nodes: [
        {
          id: 'usr_new_auditor_bob',
          type: 'Identity',
          name: 'Bob Auditor',
          tenant_id: 'tenant_demo_corp',
          properties: { status: 'active', department: 'Compliance' },
        },
      ],
      edges: [
        {
          id: 'edge_bob_reads_docs',
          source_id: 'usr_new_auditor_bob',
          target_id: 'repo_developer_docs',
          type: 'GRANTS_ACCESS',
          permission: 'read',
        },
      ],
    };

    const req = createRequest('/api/graph/ingest', 'POST', customPayload);
    const res = await handleIngest(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.nodesAdded).toBeGreaterThanOrEqual(1);
    expect(data.edgesAdded).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/simulate runs counterfactual edge removal on-demand', async () => {
    const req = createRequest('/api/simulate', 'POST', {
      candidate_edge_id: 'edge_nisha_contractors',
      identity_id: 'usr_nisha_patel',
      target_id: 'repo_billing_api',
    });

    const res = await handleSimulate(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.risky_path_broken).toBe(true);
    expect(data.identity_remaining_paths_count).toBe(0);
    expect(data.peer_impact[0].retains_access).toBe(true);
  });

  it('GET and PATCH /api/drafts manages remediation proposals', async () => {
    // 1. Create a draft via /api/draft
    const createReq = createRequest('/api/draft', 'POST', {
      candidate_edge_id: 'edge_nisha_in_contractors_dev',
      proposed_action: 'Revoke Okta Group Assignment',
      rationale: 'Terminated contractor retaining access',
      affected_identity: 'Nisha Patel',
      affected_resource: 'billing-api',
      rollback_hint: 'Reassign group in Okta',
      idempotency_key: `idemp_test_${Date.now()}`,
      draft_type: 'github_pr',
    });
    const createRes = await handleCreateDraft(createReq);
    expect(createRes.status).toBe(200);
    const draft = await createRes.json();
    expect(draft.draft_id).toBeDefined();

    // 2. Query /api/drafts
    const listRes = await handleDraftsGet();
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.total).toBeGreaterThan(0);

    // 3. Update status to APPROVED
    const patchReq = createRequest('/api/drafts', 'PATCH', {
      draft_id: draft.draft_id,
      status: 'APPROVED',
    });
    const patchRes = await handleDraftsPatch(patchReq);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.success).toBe(true);
    expect(patchData.draft.status).toBe('APPROVED');
  });

  it('GET /api/audit returns tool audit log entries', async () => {
    const res = await handleAudit();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.logs).toBeDefined();
    expect(Array.isArray(data.logs)).toBe(true);
  });
});
