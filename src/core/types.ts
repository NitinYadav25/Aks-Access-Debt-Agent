/**
 * Core type definitions for Aks: Explainable Graph-Grounded Access Debt Agent
 */

export type NodeType = 'Identity' | 'Group' | 'Role' | 'Repository' | 'CloudResource';

export type EdgeType =
  | 'MEMBER_OF'       // Identity -> Group
  | 'NESTED_IN'       // Group -> Group
  | 'ASSUMES_ROLE'    // Identity/Group -> Role
  | 'GRANTS_ACCESS'   // Group/Role -> Repository/CloudResource
  | 'OWNS';           // Identity -> Group/Repository

export type SensitivityLabel = 'high' | 'medium' | 'low';

export type IdentityStatus = 'active' | 'terminated' | 'dormant';

export interface Provenance {
  source_system: 'workday' | 'okta' | 'github' | 'aws_iam';
  source_record_id: string;
  observed_at: string; // ISO 8601 string
  valid_from?: string;
  valid_to?: string;
  confidence: number;  // 0.0 to 1.0
}

export interface NodeProperties {
  status?: IdentityStatus;
  is_contractor?: boolean;
  contract_end_date?: string;
  last_login_at?: string;
  department?: string;
  email?: string;
  sensitivity_label?: SensitivityLabel;
  owner_id?: string;
  cloud_provider?: 'aws' | 'github';
  arn?: string;
  description?: string;
  [key: string]: unknown;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  tenant_id: string;
  properties: NodeProperties;
  provenance: Provenance;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: EdgeType;
  permission?: 'admin' | 'write' | 'read';
  provenance: Provenance;
}

export interface AccessPath {
  path_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  hop_count: number;
  source_id: string;
  target_id: string;
}

export interface PeerAccessImpact {
  peer_id: string;
  peer_name: string;
  retains_access: boolean;
  remaining_paths_count: number;
}

export interface SimulationResult {
  candidate_edge_id: string;
  candidate_edge_label: string;
  target_id: string;
  target_name: string;
  identity_id: string;
  identity_name: string;
  risky_path_broken: boolean;
  identity_remaining_paths_count: number;
  peer_impact: PeerAccessImpact[];
  is_safe_remediation: boolean;
  explanation: string;
}

export interface CandidateEdgeRanking {
  edge: GraphEdge;
  edge_label: string;
  score: number; // 0 to 100 (higher means better/narrower fix)
  rationale: string;
  is_minimal: boolean;
  action_description: string;
  rollback_hint: string;
}

export type Verdict = 'PATH_FOUND' | 'NO_PATH_FOUND' | 'INSUFFICIENT_DATA';

export interface FreshnessEvaluation {
  verdict: 'FRESH' | 'STALE' | 'CONFLICT';
  is_acceptable: boolean;
  max_age_days: number;
  stale_records: {
    entity_id: string;
    source_system: string;
    observed_at: string;
    age_days: number;
  }[];
  conflicts: {
    entity_id: string;
    field: string;
    source_a: { system: string; value: unknown; observed_at: string };
    source_b: { system: string; value: unknown; observed_at: string };
    reason: string;
  }[];
  summary: string;
}

export interface PriorityScore {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number; // 0 to 100
  factors: {
    factor: string;
    points: number;
    description: string;
  }[];
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  question: string;
  subject_id: string;
  target_id?: string;
  expected_verdict: Verdict;
  expected_hops?: number;
  expected_candidate_edge_id?: string;
  notes: string;
}

export interface RawEvidenceRecord {
  id: string;
  source_system: 'workday' | 'okta' | 'github' | 'aws_iam';
  entity_type: string;
  external_id: string;
  payload: Record<string, unknown>;
  observed_at: string;
  synced_at: string;
}
