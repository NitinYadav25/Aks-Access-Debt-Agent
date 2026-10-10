import { describe, it, expect, beforeEach } from 'vitest';
import { POST as handleInvestigate } from '../../src/app/api/investigate/route';
import { POST as handleDraft } from '../../src/app/api/draft/route';
import { GET as handleScenarios } from '../../src/app/api/scenarios/route';
import { NextRequest } from 'next/server';

function createJsonRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Aks Phase 4: Web UI API & End-to-End Handlers', () => {
  describe('GET /api/scenarios', () => {
    it('returns all seeded benchmark demo scenarios', async () => {
      const res = await handleScenarios();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(4);
      expect(data[0].id).toBe('scenario_1_departed_contractor');
      expect(data[1].id).toBe('scenario_2_current_employee');
      expect(data[2].id).toBe('scenario_3_conflicting_source');
      expect(data[3].id).toBe('scenario_4_no_path_fresh');
    });
  });

  describe('POST /api/investigate', () => {
    it('executes Scenario 1: Departed contractor and returns complete 4-part payload', async () => {
      const req = createJsonRequest('/api/investigate', 'POST', {
        question: "Nisha's contract ended last month. Can her account still reach billing-api? If so, propose a safe fix.",
        subject_id: 'usr_nisha_patel',
        target_id: 'repo_billing_api',
      });

      const res = await handleInvestigate(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Screen 1: Verdict & Priority
      expect(data.verdict).toBe('PATH_FOUND');
      expect(data.verdict_badge).toBe('HIGH_RISK_PATH');
      expect(data.priority.score).toBeGreaterThanOrEqual(75);
      expect(data.priority.level).toBe('CRITICAL');

      // Screen 2: Why
      expect(data.summary_explanation).toContain('Identified 1 active multi-hop access path');

      // Screen 3: Path Chain Evidence
      expect(data.paths).toHaveLength(1);
      expect(data.paths[0].hop_count).toBe(4);
      expect(data.paths[0].nodes[0].name).toBe('Nisha Patel');
      expect(data.paths[0].nodes[4].name).toBe('billing-api');

      // Screen 4: Simulation Diff (Before/After)
      expect(data.simulation).toBeDefined();
      expect(data.simulation.risky_path_broken).toBe(true);
      expect(data.simulation.is_safe_remediation).toBe(true);
      expect(data.simulation.peer_impact[0].retains_access).toBe(true);

      // Remediation Proposal
      expect(data.recommended_remediation).toBeDefined();
      expect(data.recommended_remediation.edge.id).toBe('edge_nisha_contractors');

      // Evidence ID validation
      expect(data.validation_status.is_valid).toBe(true);
    });

    it('executes Scenario 2: Current employee returns legitimate access verification', async () => {
      const req = createJsonRequest('/api/investigate', 'POST', {
        question: 'Can Alex Rivera access billing-api?',
        subject_id: 'usr_alex_rivera',
        target_id: 'repo_billing_api',
      });

      const res = await handleInvestigate(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.verdict).toBe('PATH_FOUND');
      expect(data.verdict_badge).toBe('LEGITIMATE_ACCESS');
      expect(data.recommended_remediation).toBeUndefined();
    });

    it('executes Scenario 3: Conflicting records triggers INSUFFICIENT_DATA and blocks remediation', async () => {
      const req = createJsonRequest('/api/investigate', 'POST', {
        question: 'Can Marcus Vance reach customer PII data?',
        subject_id: 'usr_marcus_vance',
        target_id: 'cloud_customer_pii',
      });

      const res = await handleInvestigate(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.verdict).toBe('INSUFFICIENT_DATA');
      expect(data.verdict_badge).toBe('INSUFFICIENT_DATA');
      expect(data.uncertainty_notes.length).toBeGreaterThan(0);
      expect(data.recommended_remediation).toBeUndefined();
    });

    it('executes Scenario 4: Fresh data negative query returns verified NO_PATH_FOUND', async () => {
      const req = createJsonRequest('/api/investigate', 'POST', {
        question: 'Does Liam Chen have any access to billing-api?',
        subject_id: 'usr_liam_chen',
        target_id: 'repo_billing_api',
      });

      const res = await handleInvestigate(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.verdict).toBe('NO_PATH_FOUND');
      expect(data.verdict_badge).toBe('SAFE_NO_PATH');
      expect(data.paths).toHaveLength(0);
      expect(data.freshness.verdict).toBe('FRESH');
    });

    it('returns 400 bad request if question is missing', async () => {
      const req = createJsonRequest('/api/investigate', 'POST', {});
      const res = await handleInvestigate(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/draft', () => {
    it('creates an approval-ready mock remediation PR draft with [DRAFT ONLY] disclaimer', async () => {
      const req = createJsonRequest('/api/draft', 'POST', {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: "Remove user 'Nisha Patel' from group 'contractors-dev'",
        rationale: 'Departed contractor retains indirect path to billing-api.',
        affected_identity: 'Nisha Patel',
        affected_resource: 'billing-api',
        rollback_hint: "Re-assign user 'Nisha Patel' to group 'contractors-dev'",
        idempotency_key: 'idemp_ui_test_441',
        draft_type: 'github_pr',
      });

      const res = await handleDraft(req);
      expect(res.status).toBe(200);
      const draft = await res.json();

      expect(draft.status).toBe('DRAFT_ONLY');
      expect(draft.title).toContain('[DRAFT ONLY]');
      expect(draft.body_markdown).toContain('NO PERMISSIONS HAVE BEEN MUTATED');
      expect(draft.rollback_instructions).toContain('Re-assign user');
    });

    it('preserves idempotency on duplicate draft requests', async () => {
      const payload = {
        candidate_edge_id: 'edge_nisha_contractors',
        proposed_action: 'Action',
        rationale: 'Rationale',
        affected_identity: 'Nisha Patel',
        affected_resource: 'billing-api',
        rollback_hint: 'Rollback',
        idempotency_key: 'idemp_idempotent_key_77',
        draft_type: 'github_pr',
      };

      const res1 = await handleDraft(createJsonRequest('/api/draft', 'POST', payload));
      const res2 = await handleDraft(createJsonRequest('/api/draft', 'POST', payload));

      const d1 = await res1.json();
      const d2 = await res2.json();

      expect(d1.draft_id).toBe(d2.draft_id);
    });
  });
});
