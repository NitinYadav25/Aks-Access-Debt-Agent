import { describe, it, expect, beforeEach } from 'vitest';
import { loadSyntheticFixtures } from '../../src/core/loader';
import { InMemoryAccessGraph } from '../../src/core/graph';
import { GraphTraversalEngine } from '../../src/core/traversal';
import { CounterfactualSimulator } from '../../src/core/simulation';
import { CandidateRankingEngine } from '../../src/core/ranking';
import { FreshnessEvaluator } from '../../src/core/freshness';
import { GraphEdge } from '../../src/core/types';

describe('Aks Phase 1: Core Graph Schema & Synthetic Scenarios', () => {
  let fixtures: ReturnType<typeof loadSyntheticFixtures>;
  let graph: InMemoryAccessGraph;
  let traversal: GraphTraversalEngine;
  let simulator: CounterfactualSimulator;
  let ranking: CandidateRankingEngine;
  let freshness: FreshnessEvaluator;

  beforeEach(() => {
    fixtures = loadSyntheticFixtures();
    graph = fixtures.graph;
    traversal = new GraphTraversalEngine(graph);
    simulator = new CounterfactualSimulator(graph);
    ranking = new CandidateRankingEngine(graph);
    freshness = new FreshnessEvaluator({
      referenceDate: new Date('2026-10-10T00:00:00.000Z'),
      maxAgeDays: 30,
    });
  });

  describe('Graph Foundation & Provenance Layer', () => {
    it('initializes the graph with canonical node and edge schemas', () => {
      const schema = graph.getSchema();
      expect(schema.totalNodes).toBeGreaterThanOrEqual(10);
      expect(schema.totalEdges).toBeGreaterThanOrEqual(10);
      expect(schema.nodeTypes).toContain('Identity');
      expect(schema.nodeTypes).toContain('Group');
      expect(schema.nodeTypes).toContain('Role');
      expect(schema.nodeTypes).toContain('Repository');
      expect(schema.nodeTypes).toContain('CloudResource');
      expect(schema.edgeTypes).toContain('MEMBER_OF');
      expect(schema.edgeTypes).toContain('NESTED_IN');
      expect(schema.edgeTypes).toContain('ASSUMES_ROLE');
      expect(schema.edgeTypes).toContain('GRANTS_ACCESS');
      expect(schema.tenantBoundary).toBe('tenant_demo_corp');
    });

    it('ensures every node and edge stores source system, record ID, and observed timestamp', () => {
      const allNodes = graph.getAllNodes();
      for (const node of allNodes) {
        expect(node.id).toBeDefined();
        expect(node.provenance.source_system).toBeDefined();
        expect(node.provenance.source_record_id).toBeDefined();
        expect(node.provenance.observed_at).toBeDefined();
        expect(node.provenance.confidence).toBeGreaterThan(0);
      }

      const allEdges = graph.getAllEdges();
      for (const edge of allEdges) {
        expect(edge.id).toBeDefined();
        expect(edge.source_id).toBeDefined();
        expect(edge.target_id).toBeDefined();
        expect(edge.provenance.source_system).toBeDefined();
        expect(edge.provenance.source_record_id).toBeDefined();
        expect(edge.provenance.observed_at).toBeDefined();
      }
    });

    it('handles cyclic relationships safely without infinite recursion', () => {
      // Create a cyclic edge: grp_engineering_core -> grp_contractors_dev
      const cyclicEdge: GraphEdge = {
        id: 'edge_cyclic_test',
        source_id: 'grp_engineering_core',
        target_id: 'grp_contractors_dev',
        type: 'NESTED_IN',
        provenance: {
          source_system: 'github',
          source_record_id: 'gh_cyclic_001',
          observed_at: '2026-10-10T00:00:00.000Z',
          confidence: 1.0,
        },
      };
      graph.addEdge(cyclicEdge);

      const paths = traversal.findAccessPaths('usr_nisha_patel', {
        targetId: 'repo_billing_api',
        maxHops: 6,
      });

      expect(paths.length).toBeGreaterThan(0);
      // Ensure no path contains duplicate nodes (cycles are detected and prevented)
      for (const path of paths) {
        const visitedIds = new Set(path.nodes.map((n) => n.id));
        expect(visitedIds.size).toBe(path.nodes.length);
      }
    });
  });

  describe('Scenario 1: Departed Contractor Nested Access Path', () => {
    it('finds the 4-hop access chain from Nisha to billing-api', () => {
      const paths = traversal.findAccessPaths('usr_nisha_patel', {
        targetId: 'repo_billing_api',
        maxHops: 6,
      });

      expect(paths.length).toBe(1);
      const path = paths[0];
      expect(path.hop_count).toBe(4);

      // Verify exact chain: Nisha -> contractors-dev -> engineering-core -> repo-reader -> billing-api
      expect(path.nodes.map((n) => n.id)).toEqual([
        'usr_nisha_patel',
        'grp_contractors_dev',
        'grp_engineering_core',
        'role_repo_reader',
        'repo_billing_api',
      ]);

      // Verify edge sequence
      expect(path.edges.map((e) => e.type)).toEqual([
        'MEMBER_OF',
        'NESTED_IN',
        'ASSUMES_ROLE',
        'GRANTS_ACCESS',
      ]);
    });

    it('ranks candidate edge removals and selects Nisha direct membership as minimal fix', () => {
      const paths = traversal.findAccessPaths('usr_nisha_patel', {
        targetId: 'repo_billing_api',
      });
      const candidates = ranking.rankCandidates(paths[0]);

      expect(candidates.length).toBe(4);
      const topCandidate = candidates[0];
      expect(topCandidate.is_minimal).toBe(true);
      expect(topCandidate.edge.id).toBe('edge_nisha_contractors');
      expect(topCandidate.score).toBe(95);
      expect(topCandidate.action_description).toContain('Remove identity');
      expect(topCandidate.rollback_hint).toContain('Re-assign membership');
    });

    it('simulates minimal edge removal: breaks risky path while preserving peer Alex access', () => {
      const sim = simulator.simulateEdgeRemoval({
        candidateEdgeId: 'edge_nisha_contractors',
        identityId: 'usr_nisha_patel',
        targetId: 'repo_billing_api',
        peerIds: ['usr_alex_rivera'],
      });

      expect(sim.risky_path_broken).toBe(true);
      expect(sim.identity_remaining_paths_count).toBe(0);
      expect(sim.is_safe_remediation).toBe(true);
      expect(sim.peer_impact).toHaveLength(1);
      expect(sim.peer_impact[0].peer_id).toBe('usr_alex_rivera');
      expect(sim.peer_impact[0].retains_access).toBe(true);
    });

    it('rejects an over-broad proposal (e.g. revoking repo grant) because it breaks legitimate peer access', () => {
      // Simulating removing the shared repo reader grant instead of Nisha's membership
      const broadSim = simulator.simulateEdgeRemoval({
        candidateEdgeId: 'edge_reader_billing',
        identityId: 'usr_nisha_patel',
        targetId: 'repo_billing_api',
        peerIds: ['usr_alex_rivera'],
      });

      expect(broadSim.risky_path_broken).toBe(true);
      // Crucial: Alex loses access too, so this change is NOT safe!
      expect(broadSim.peer_impact[0].retains_access).toBe(false);
      expect(broadSim.is_safe_remediation).toBe(false);
      expect(broadSim.explanation).toContain('CAUTION');
    });
  });

  describe('Scenario 2: Current Employee Legitimate Access Verification', () => {
    it('confirms Alex Rivera has a valid active access path to billing-api', () => {
      const paths = traversal.findAccessPaths('usr_alex_rivera', {
        targetId: 'repo_billing_api',
        maxHops: 6,
      });

      expect(paths.length).toBe(1);
      const path = paths[0];
      expect(path.hop_count).toBe(3);
      expect(path.nodes.map((n) => n.id)).toEqual([
        'usr_alex_rivera',
        'grp_engineering_core',
        'role_repo_reader',
        'repo_billing_api',
      ]);
    });

    it('verifies Alex data is fresh and active', () => {
      const alexNode = graph.getNode('usr_alex_rivera')!;
      expect(alexNode.properties.status).toBe('active');

      const evaluation = freshness.evaluateNodeFreshness(alexNode);
      expect(evaluation.verdict).toBe('FRESH');
      expect(evaluation.is_acceptable).toBe(true);
    });
  });

  describe('Scenario 3: Stale and Conflicting Source Record (Uncertainty)', () => {
    it('detects conflicting Workday vs Okta records and flags CONFLICT', () => {
      const paths = traversal.findAccessPaths('usr_marcus_vance', {
        targetId: 'cloud_customer_pii',
        maxHops: 6,
      });

      expect(paths.length).toBe(1);
      const path = paths[0];

      const evaluation = freshness.evaluatePathFreshness(path, fixtures.rawEvidence);

      expect(evaluation.verdict).toBe('CONFLICT');
      expect(evaluation.is_acceptable).toBe(false);
      expect(evaluation.conflicts.length).toBeGreaterThan(0);
      expect(evaluation.conflicts[0].field).toBe('status');
      expect(evaluation.conflicts[0].source_a.system).toBe('workday');
      expect(evaluation.conflicts[0].source_b.system).toBe('okta');
      expect(evaluation.summary).toContain('Automated remediation must be blocked');
    });
  });

  describe('Scenario 4: Fresh Data Verified Absence of Path', () => {
    it('returns empty path array when no access path exists for Liam Chen', () => {
      const paths = traversal.findAccessPaths('usr_liam_chen', {
        targetId: 'repo_billing_api',
        maxHops: 6,
      });

      expect(paths).toHaveLength(0);
    });

    it('verifies source freshness for negative query to certify definitive absence', () => {
      const liamNode = graph.getNode('usr_liam_chen')!;
      const evaluation = freshness.evaluateNodeFreshness(liamNode);

      expect(evaluation.verdict).toBe('FRESH');
      expect(evaluation.is_acceptable).toBe(true);
      expect(evaluation.stale_records).toHaveLength(0);
    });
  });
});
