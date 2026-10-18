export type ToolScope = 'read' | 'write';

export interface ToolAuditLog {
  id: string;
  timestamp: string;
  tool_name: string;
  scope: ToolScope;
  sanitized_input: Record<string, unknown>;
  status: 'success' | 'error';
  duration_ms: number;
  error_message?: string;
}

export interface RemediationDraft {
  draft_id: string;
  idempotency_key: string;
  status: 'DRAFT_ONLY' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  draft_type: 'github_pr' | 'jira_ticket';
  created_at: string;
  title: string;
  body_markdown: string;
  affected_identity: string;
  affected_resource: string;
  candidate_edge_id: string;
  proposed_action: string;
  rollback_instructions: string;
  disclaimer: string;
}
