import {
  AccessPath,
  CandidateEdgeRanking,
  FreshnessEvaluation,
  PriorityScore,
  SimulationResult,
  Verdict,
} from '../core/types';
import { ToolAuditLog } from '../mcp/types';

export interface InvestigationQuery {
  question: string;
  subject_id?: string;
  target_id?: string;
  max_hops?: number;
  engine_mode?: 'deterministic' | 'model';
}

export interface AccessPathSummaryNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  sensitivity?: string;
}

export interface AccessPathSummaryEdge {
  id: string;
  type: string;
  source_id: string;
  target_id: string;
  source_name: string;
  target_name: string;
  permission?: string;
  source_system: string;
  observed_at: string;
  record_id: string;
}

export interface AccessPathSummary {
  path_id: string;
  hop_count: number;
  nodes: AccessPathSummaryNode[];
  edges: AccessPathSummaryEdge[];
  readable_chain: string;
}

export interface ValidationStatus {
  is_valid: boolean;
  total_claims_checked: number;
  verified_entity_ids: string[];
  rejected_claims: string[];
}

export interface InvestigationResult {
  question: string;
  verdict: Verdict;
  verdict_badge: 'HIGH_RISK_PATH' | 'LEGITIMATE_ACCESS' | 'INSUFFICIENT_DATA' | 'SAFE_NO_PATH';
  summary_explanation: string;
  priority: PriorityScore;
  paths: AccessPathSummary[];
  freshness: FreshnessEvaluation;
  simulation?: SimulationResult;
  recommended_remediation?: CandidateEdgeRanking;
  validation_status: ValidationStatus;
  tool_traces: ToolAuditLog[];
  uncertainty_notes: string[];
  generated_at: string;
}
