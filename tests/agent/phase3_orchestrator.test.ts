import { describe, it, expect, beforeEach } from 'vitest';
import { loadSyntheticFixtures } from '../../src/core/loader';
import { AksMcpServer } from '../../src/mcp/server';
import { AksMcpClient } from '../../src/mcp/client';
import { AksAgentOrchestrator } from '../../src/agent/orchestrator';
import { EvidenceValidator } from '../../src/agent/validator';
import { ExplainablePriorityCalculator } from '../../src/agent/priority';

describe('Aks Phase 3: Agent Orchestrator & Evidence Validation Layer', () => {
  let fixtures: ReturnType<typeof loadSyntheticFixtures>;
  let server: AksMcpServer;
  let client: AksMcpClient;
  let orchestrator: AksAgentOrchestrator;
  let validator: EvidenceValidator;
  let priorityCalculator: ExplainablePriorityCalculator;

  beforeEach(async () => {
    fixtures = loadSyntheticFixtures();
    server = new AksMcpServer({
      graph: fixtures.graph,
      rawEvidence: fixtures.rawEvidence,
    });
    client = new AksMcpClient(server);
    await client.connect();

    orchestrator = new AksAgentOrchestrator({
      mcpClient: client,
      graph: fixtures.graph,
      rawEvidence: fixtures.rawEvidence,
    });

    validator = new EvidenceValidator(fixtures.graph);
    priorityCalculator = new ExplainablePriorityCalculator();
  });

  describe('Scenario 1: Departed Contractor Access Investigation', () => {
    it('executes full investigation through MCP, proves break, and preserves peer access', async () => {
      const result = await orchestrator.investigate({
        question: "Nisha's contract ended last month. Can her account still reach billing-api? If so, propose a safe fix.",
        subject_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
      });

      expect(result.verdict).toBe('PATH_FOUND');
      expect(result.verdict_badge).toBe('HIGH_RISK_PATH');
      expect(result.priority.level).toBe('CRITICAL');
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].hop_count).toBe(4);

      // Verify minimal remediation proposal
      expect(result.recommended_remediation).toBeDefined();
      expect(result.recommended_remediation?.edge.id).toBe('edge_nisha_contractors');
      expect(result.recommended_remediation?.is_minimal).toBe(true);

      // Verify counterfactual simulation
      expect(result.simulation).toBeDefined();
      expect(result.simulation?.risky_path_broken).toBe(true);
      expect(result.simulation?.is_safe_remediation).toBe(true);
      expect(result.simulation?.peer_impact[0].retains_access).toBe(true);

      // Verify 100% evidence resolution (no hallucinated IDs)
      expect(result.validation_status.is_valid).toBe(true);
      expect(result.validation_status.rejected_claims).toHaveLength(0);

      // Verify tool trace captures MCP protocol execution
      expect(result.tool_traces.length).toBeGreaterThanOrEqual(3);
      const toolNames = result.tool_traces.map((t) => t.tool_name);
      expect(toolNames).toContain('find_access_paths');
      expect(toolNames).toContain('get_entity_evidence');
      expect(toolNames).toContain('simulate_edge_removal');
    });
  });

  describe('Scenario 2: Current Employee Legitimate Access', () => {
    it('confirms legitimate access without proposing disruptive remediation', async () => {
      const result = await orchestrator.investigate({
        question: 'Can Alex Rivera access billing-api?',
        subject_id: 'usr_alex_rivera',
        target_id: 'repo_billing_api',
      });

      expect(result.verdict).toBe('PATH_FOUND');
      expect(result.verdict_badge).toBe('LEGITIMATE_ACCESS');
      expect(result.priority.level).toBe('LOW');
      expect(result.recommended_remediation).toBeUndefined();
      expect(result.summary_explanation).toContain('Legitimate access verified');
      expect(result.validation_status.is_valid).toBe(true);
    });
  });

  describe('Scenario 3: Stale and Conflicting Records (Uncertainty)', () => {
    it('detects conflicting Workday vs Okta data and blocks automated remediation', async () => {
      const result = await orchestrator.investigate({
        question: 'Can Marcus Vance reach customer PII data in the cloud account?',
        subject_id: 'usr_marcus_vance',
        target_id: 'cloud_customer_pii',
      });

      expect(result.verdict).toBe('INSUFFICIENT_DATA');
      expect(result.verdict_badge).toBe('INSUFFICIENT_DATA');
      expect(result.freshness.verdict).toBe('CONFLICT');
      expect(result.uncertainty_notes.length).toBeGreaterThan(0);
      expect(result.uncertainty_notes[0]).toContain('Conflicting HR vs Identity status');
      expect(result.recommended_remediation).toBeUndefined(); // Remediation blocked!
    });
  });

  describe('Scenario 4: Fresh Data Verified Absence of Path', () => {
    it('returns definitive NO_PATH_FOUND with verified freshness certificate', async () => {
      const result = await orchestrator.investigate({
        question: 'Does Liam Chen have any indirect access to billing-api?',
        subject_id: 'usr_liam_chen',
        target_id: 'repo_billing_api',
      });

      expect(result.verdict).toBe('NO_PATH_FOUND');
      expect(result.verdict_badge).toBe('SAFE_NO_PATH');
      expect(result.paths).toHaveLength(0);
      expect(result.freshness.verdict).toBe('FRESH');
      expect(result.priority.level).toBe('LOW');
      expect(result.summary_explanation).toContain('No indirect or direct access paths found');
    });
  });

  describe('Evidence Validator Guard (Hallucination Rejection)', () => {
    it('rejects fabricated entity identifiers not present in the graph', () => {
      const check = validator.validateEntityIds([
        'usr_nisha_patel',
        'usr_hallucinated_ghost_user_999',
        'edge_invented_connection_000',
      ]);

      expect(check.is_valid).toBe(false);
      expect(check.rejected_claims).toHaveLength(2);
      expect(check.rejected_claims[0]).toContain('usr_hallucinated_ghost_user_999');
      expect(check.rejected_claims[1]).toContain('edge_invented_connection_000');
    });

    it('rejects fabricated path edge topologies where endpoints do not match real graph records', () => {
      const fabricatedPath = [
        {
          path_id: 'fake_path_1',
          hop_count: 1,
          readable_chain: 'Nisha ➔ billing-api',
          nodes: [
            { id: 'usr_nisha_patel', name: 'Nisha Patel', type: 'Identity' },
            { id: 'repo_billing_api', name: 'billing-api', type: 'Repository' },
          ],
          edges: [
            {
              id: 'edge_nisha_contractors', // Real edge ID, but real target is grp_contractors_dev, not repo_billing_api!
              type: 'MEMBER_OF',
              source_id: 'usr_nisha_patel',
              target_id: 'repo_billing_api', // Fabricated target!
              source_name: 'Nisha Patel',
              target_name: 'billing-api',
              source_system: 'okta',
              observed_at: '2026-10-10T00:00:00Z',
              record_id: 'rec_fake',
            },
          ],
        },
      ];

      const validation = validator.validatePaths(fabricatedPath);
      expect(validation.is_valid).toBe(false);
      expect(validation.rejected_claims[0]).toContain('Invalid Edge Topology');
    });
  });

  describe('Explainable Priority Calculator', () => {
    it('computes transparent contributing factors for sensitive contractor access', () => {
      const nishaNode = fixtures.graph.getNode('usr_nisha_patel');
      const billingNode = fixtures.graph.getNode('repo_billing_api');
      const paths = fixtures.graph.getAllNodes();

      const samplePath = {
        path_id: 'test_path',
        nodes: [nishaNode!, billingNode!],
        edges: [fixtures.graph.getEdge('edge_reader_billing')!],
        hop_count: 4,
        source_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
      };

      const priority = priorityCalculator.calculatePriority(samplePath, nishaNode, billingNode);

      expect(priority.score).toBeGreaterThanOrEqual(75);
      expect(priority.level).toBe('CRITICAL');
      const factorNames = priority.factors.map((f) => f.factor);
      expect(factorNames).toContain('High-Sensitivity Resource');
      expect(factorNames).toContain('Departed / Terminated Identity');
      expect(factorNames).toContain('Multi-Hop Access Debt');
    });
  });
});
