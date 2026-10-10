import { z } from 'zod';

export const GetGraphSchemaInputSchema = z.object({
  tenant_id: z.string().optional().describe('Tenant identifier for isolation boundary'),
});

export type GetGraphSchemaInput = z.infer<typeof GetGraphSchemaInputSchema>;

export const FindAccessPathsInputSchema = z.object({
  source_id: z.string().min(1).describe('The identity or entity ID to start traversal from'),
  target_id: z.string().optional().describe('Optional specific target repository or cloud resource ID'),
  max_hops: z.number().int().min(1).max(6).default(6).describe('Maximum hops to traverse (bounded at 6)'),
  target_sensitivity: z.enum(['high', 'medium', 'low']).optional().describe('Filter destinations by sensitivity label'),
  min_observed_at: z.string().optional().describe('Filter out evidence older than this ISO timestamp'),
});

export type FindAccessPathsInput = z.infer<typeof FindAccessPathsInputSchema>;

export const GetEntityEvidenceInputSchema = z.object({
  entity_ids: z.array(z.string().min(1)).min(1).max(50).describe('List of entity or edge IDs to retrieve evidence for'),
});

export type GetEntityEvidenceInput = z.infer<typeof GetEntityEvidenceInputSchema>;

export const SimulateEdgeRemovalInputSchema = z.object({
  candidate_edge_id: z.string().min(1).describe('The edge ID proposed for removal'),
  source_id: z.string().min(1).describe('The subject identity ID whose access should be broken'),
  target_id: z.string().min(1).describe('The sensitive resource ID'),
  peer_identity_ids: z.array(z.string()).optional().describe('Active peer IDs whose legitimate access must remain intact'),
  max_hops: z.number().int().min(1).max(6).default(6).describe('Max hops for simulation traversal'),
});

export type SimulateEdgeRemovalInput = z.infer<typeof SimulateEdgeRemovalInputSchema>;

export const CreateRemediationDraftInputSchema = z.object({
  candidate_edge_id: z.string().min(1).describe('The validated candidate edge ID'),
  proposed_action: z.string().min(1).describe('Plain-language action description'),
  rationale: z.string().min(1).describe('Justification citing risky path and simulation result'),
  affected_identity: z.string().min(1).describe('The departed/stale identity'),
  affected_resource: z.string().min(1).describe('The sensitive destination resource'),
  rollback_hint: z.string().min(1).describe('Actionable restore/rollback instruction'),
  idempotency_key: z.string().min(1).describe('Unique key to prevent duplicate drafts'),
  draft_type: z.enum(['github_pr', 'jira_ticket']).default('github_pr').describe('Target draft output format'),
});

export type CreateRemediationDraftInput = z.infer<typeof CreateRemediationDraftInputSchema>;
