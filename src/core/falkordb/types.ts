export interface FalkorDBConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  graphName: string;
}

export interface FalkorDBStatus {
  connected: boolean;
  mode: 'connected' | 'emulated';
  graphName: string;
  endpoint: string;
  nodeCount: number;
  edgeCount: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export interface FalkorDBSyncResult {
  success: boolean;
  nodesCreated: number;
  edgesCreated: number;
  executionTimeMs: number;
  graphName: string;
  statementsExecuted: number;
  error?: string;
}

export interface CypherQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTimeMs: number;
  cypher: string;
  explainPlan?: string;
  engine: 'falkordb-live' | 'falkordb-emulated';
}
