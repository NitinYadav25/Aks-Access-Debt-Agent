import { describe, it, expect, beforeEach } from 'vitest';
import { getFalkorDBService, FalkorDBService } from '../../src/core/falkordb/client';
import { FalkorDBCypherTraversalEngine } from '../../src/core/falkordb/traversal';
import { loadSyntheticFixtures } from '../../src/core/loader';
import { GET as handleStatus, POST as handleUpdateConfig } from '../../src/app/api/falkordb/status/route';
import { POST as handleSync } from '../../src/app/api/falkordb/sync/route';
import { POST as handleQuery } from '../../src/app/api/falkordb/query/route';
import { NextRequest } from 'next/server';

function createJsonRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('FalkorDB Graph Engine & OpenCypher Integration Suite', () => {
  let fixtures: ReturnType<typeof loadSyntheticFixtures>;
  let falkor: FalkorDBService;

  beforeEach(() => {
    fixtures = loadSyntheticFixtures();
    falkor = getFalkorDBService();
  });

  describe('FalkorDB Client Service & Lifecycle', () => {
    it('initializes service with safe emulated/offline fallback', () => {
      const status = falkor.getStatus();
      expect(status.graphName).toBe('aks_access_debt');
      expect(status.mode).toBeDefined();
    });

    it('synchronizes active access graph into FalkorDB database representation', async () => {
      const syncResult = await falkor.syncGraph(fixtures.graph);
      expect(syncResult.success).toBe(true);
      expect(syncResult.nodesCreated).toBe(fixtures.graph.getAllNodes().length);
      expect(syncResult.edgesCreated).toBe(fixtures.graph.getAllEdges().length);
      expect(syncResult.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('executes OpenCypher entity query and returns structured tabular results', async () => {
      const query = 'MATCH (i:Identity) RETURN i.name, i.status';
      const result = await falkor.query(query, {}, fixtures.graph);

      expect(result.columns).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.cypher).toBe(query);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('executes OpenCypher multi-hop path traversal query', async () => {
      const cypher = "MATCH p = (s {id: 'usr_nisha_patel'})-[*1..5]->(t {id: 'repo_billing_api'}) RETURN p";
      const result = await falkor.query(cypher, { subjectId: 'usr_nisha_patel', targetId: 'repo_billing_api' }, fixtures.graph);

      expect(result.columns).toContain('hop_count');
      expect(result.columns).toContain('candidate_remediation_edge');
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].candidate_remediation_edge).toBe('edge_nisha_contractors');
    });
  });

  describe('FalkorDBCypherTraversalEngine', () => {
    it('finds access paths using OpenCypher and returns ground truth path chain', async () => {
      const engine = new FalkorDBCypherTraversalEngine(fixtures.graph, falkor);
      const res = await engine.findAccessPaths('usr_nisha_patel', {
        targetId: 'repo_billing_api',
        maxHops: 5,
      });

      expect(res.paths).toHaveLength(1);
      expect(res.paths[0].hop_count).toBe(4);
      expect(res.generatedCypher).toContain('MATCH p = (s {id: \'usr_nisha_patel\'})');
      expect(res.generatedCypher).toContain('repo_billing_api');
    });

    it('executes zero-mutation counterfactual edge cut test via OpenCypher NONE() predicate', async () => {
      const engine = new FalkorDBCypherTraversalEngine(fixtures.graph, falkor);
      const res = await engine.simulateEdgeRemoval({
        candidateEdgeId: 'edge_nisha_contractors',
        identityId: 'usr_nisha_patel',
        targetId: 'repo_billing_api',
        peerIds: ['usr_alex_rivera'],
      });

      expect(res.simulation.risky_path_broken).toBe(true);
      expect(res.simulation.is_safe_remediation).toBe(true);
      expect(res.generatedCypher).toContain('WHERE NONE(rel IN relationships(p) WHERE rel.id = \'edge_nisha_contractors\')');
    });
  });

  describe('FalkorDB REST APIs', () => {
    it('GET /api/falkordb/status returns status and config', async () => {
      const res = await handleStatus();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBeDefined();
      expect(data.config).toBeDefined();
      expect(data.config.graphName).toBe('aks_access_debt');
    });

    it('POST /api/falkordb/sync triggers graph sync and returns execution metrics', async () => {
      const res = await handleSync();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.nodesCreated).toBeGreaterThan(0);
      expect(data.edgesCreated).toBeGreaterThan(0);
    });

    it('POST /api/falkordb/query runs OpenCypher query via API', async () => {
      const req = createJsonRequest('/api/falkordb/query', 'POST', {
        cypher: "MATCH (i:Identity) RETURN i.name",
      });
      const res = await handleQuery(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.columns).toBeDefined();
      expect(data.rows.length).toBeGreaterThan(0);
    });
  });
});
