import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryAccessGraph } from '../core/graph';
import { GraphTraversalEngine } from '../core/traversal';
import { CounterfactualSimulator } from '../core/simulation';
import { FreshnessEvaluator } from '../core/freshness';
import { RawEvidenceRecord } from '../core/types';
import { DraftStore } from './draft-store';
import { ToolAuditLog, ToolScope } from './types';
import {
  GetGraphSchemaInputSchema,
  FindAccessPathsInputSchema,
  GetEntityEvidenceInputSchema,
  SimulateEdgeRemovalInputSchema,
  CreateRemediationDraftInputSchema,
  FalkorDBCypherQueryInputSchema,
} from './schemas';
import { getFalkorDBService } from '../core/falkordb/client';


export interface AksMcpServerOptions {
  graph: InMemoryAccessGraph;
  rawEvidence: RawEvidenceRecord[];
  draftStore?: DraftStore;
  timeoutMs?: number;
}

export class AksMcpServer {
  private server: Server;
  private graph: InMemoryAccessGraph;
  private rawEvidence: RawEvidenceRecord[];
  private draftStore: DraftStore;
  private timeoutMs: number;
  private auditLogs: ToolAuditLog[] = [];
  private logCounter = 0;

  constructor(options: AksMcpServerOptions) {
    this.graph = options.graph;
    this.rawEvidence = options.rawEvidence;
    this.draftStore = options.draftStore ?? new DraftStore();
    this.timeoutMs = options.timeoutMs ?? 5000;

    this.server = new Server(
      {
        name: 'aks-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers();
  }

  public getRawServer(): Server {
    return this.server;
  }

  public getAuditLogs(): ToolAuditLog[] {
    return [...this.auditLogs];
  }

  public getDraftStore(): DraftStore {
    return this.draftStore;
  }

  private registerHandlers(): void {
    // 1. Tool Discovery Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_graph_schema',
            description: 'Inspect the canonical graph schema: node types, edge types, total entities, and tenant boundary.',
            inputSchema: {
              type: 'object',
              properties: {
                tenant_id: {
                  type: 'string',
                  description: 'Tenant identifier for isolation boundary',
                },
              },
            },
          },
          {
            name: 'find_access_paths',
            description: 'Find bounded multi-hop access paths from an identity to sensitive resources or targets (max 6 hops).',
            inputSchema: {
              type: 'object',
              properties: {
                source_id: {
                  type: 'string',
                  description: 'The identity or entity ID to start traversal from',
                },
                target_id: {
                  type: 'string',
                  description: 'Optional specific target repository or cloud resource ID',
                },
                max_hops: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 6,
                  default: 6,
                  description: 'Maximum hops to traverse (bounded at 6)',
                },
                target_sensitivity: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Filter destinations by sensitivity label',
                },
                min_observed_at: {
                  type: 'string',
                  description: 'Filter out evidence older than this ISO timestamp',
                },
              },
              required: ['source_id'],
            },
          },
          {
            name: 'get_entity_evidence',
            description: 'Fetch source provenance records, observation timestamps, and freshness/conflict evaluations for entity and edge IDs.',
            inputSchema: {
              type: 'object',
              properties: {
                entity_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of entity or edge IDs to retrieve evidence for (max 50)',
                },
              },
              required: ['entity_ids'],
            },
          },
          {
            name: 'simulate_edge_removal',
            description: 'Simulate counterfactual removal of a candidate edge and verify whether the risky path is closed and peers retain access.',
            inputSchema: {
              type: 'object',
              properties: {
                candidate_edge_id: {
                  type: 'string',
                  description: 'The edge ID proposed for removal',
                },
                source_id: {
                  type: 'string',
                  description: 'The subject identity ID whose access should be broken',
                },
                target_id: {
                  type: 'string',
                  description: 'The sensitive resource ID',
                },
                peer_identity_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Active peer IDs whose legitimate access must remain intact',
                },
                max_hops: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 6,
                  default: 6,
                  description: 'Max hops for simulation traversal',
                },
              },
              required: ['candidate_edge_id', 'source_id', 'target_id'],
            },
          },
          {
            name: 'create_remediation_draft',
            description: 'Scoped write tool: Create a mock approval-ready pull request or Jira ticket draft [DRAFT ONLY]. No live systems are mutated.',
            inputSchema: {
              type: 'object',
              properties: {
                candidate_edge_id: {
                  type: 'string',
                  description: 'The validated candidate edge ID',
                },
                proposed_action: {
                  type: 'string',
                  description: 'Plain-language action description',
                },
                rationale: {
                  type: 'string',
                  description: 'Justification citing risky path and simulation result',
                },
                affected_identity: {
                  type: 'string',
                  description: 'The departed/stale identity',
                },
                affected_resource: {
                  type: 'string',
                  description: 'The sensitive destination resource',
                },
                rollback_hint: {
                  type: 'string',
                  description: 'Actionable restore/rollback instruction',
                },
                idempotency_key: {
                  type: 'string',
                  description: 'Unique key to prevent duplicate drafts',
                },
                draft_type: {
                  type: 'string',
                  enum: ['github_pr', 'jira_ticket'],
                  default: 'github_pr',
                  description: 'Target draft output format',
                },
              },
              required: [
                'candidate_edge_id',
                'proposed_action',
                'rationale',
                'affected_identity',
                'affected_resource',
                'rollback_hint',
                'idempotency_key',
              ],
            },
          },
          {
            name: 'falkordb_cypher_query',
            description: 'Execute native OpenCypher queries on the FalkorDB access graph (paths, blast radius, counterfactuals).',
            inputSchema: {
              type: 'object',
              properties: {
                cypher: {
                  type: 'string',
                  description: 'OpenCypher query to execute on FalkorDB',
                },
                params: {
                  type: 'object',
                  description: 'Optional query parameters map',
                },
              },
              required: ['cypher'],
            },
          },
        ],
      };
    });

    // 2. Tool Execution Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: rawArgs } = request.params;
      const startTime = Date.now();
      const scope: ToolScope = name === 'create_remediation_draft' ? 'write' : 'read';

      try {
        const result = await this.executeToolWithTimeout(name, rawArgs || {});
        const durationMs = Date.now() - startTime;

        this.logToolCall(name, scope, rawArgs || {}, 'success', durationMs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        this.logToolCall(name, scope, rawArgs || {}, 'error', durationMs, errorMessage);

        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
        };
      }
    });
  }

  private async executeToolWithTimeout(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return Promise.race([
      this.dispatchTool(toolName, args),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`MCP Tool '${toolName}' timed out after ${this.timeoutMs}ms`)),
          this.timeoutMs
        )
      ),
    ]);
  }

  private async dispatchTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'get_graph_schema': {
        const validated = GetGraphSchemaInputSchema.parse(args);
        const schema = this.graph.getSchema();
        if (validated.tenant_id && validated.tenant_id !== schema.tenantBoundary) {
          throw new Error(`Tenant '${validated.tenant_id}' not found. Boundary is '${schema.tenantBoundary}'.`);
        }
        return {
          schema,
          allowedRelationshipDirections: [
            'Identity -[MEMBER_OF]-> Group',
            'Group -[NESTED_IN]-> Group',
            'Identity/Group -[ASSUMES_ROLE]-> Role',
            'Group/Role -[GRANTS_ACCESS]-> Repository/CloudResource',
            'Identity -[OWNS]-> Group/Repository/CloudResource',
          ],
        };
      }

      case 'find_access_paths': {
        const validated = FindAccessPathsInputSchema.parse(args);
        const traversal = new GraphTraversalEngine(this.graph);

        const paths = traversal.findAccessPaths(validated.source_id, {
          targetId: validated.target_id,
          maxHops: validated.max_hops,
          targetSensitivity: validated.target_sensitivity,
        });

        return {
          source_id: validated.source_id,
          target_id: validated.target_id || null,
          max_hops: validated.max_hops,
          total_paths_found: paths.length,
          paths: paths.map((p) => ({
            path_id: p.path_id,
            hop_count: p.hop_count,
            source_id: p.source_id,
            target_id: p.target_id,
            nodes: p.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              name: n.name,
              status: n.properties.status,
              sensitivity: n.properties.sensitivity_label,
            })),
            edges: p.edges.map((e) => ({
              id: e.id,
              source_id: e.source_id,
              target_id: e.target_id,
              type: e.type,
              permission: e.permission,
              observed_at: e.provenance.observed_at,
            })),
          })),
        };
      }

      case 'get_entity_evidence': {
        const validated = GetEntityEvidenceInputSchema.parse(args);
        const entities: Record<string, unknown>[] = [];

        for (const id of validated.entity_ids) {
          const node = this.graph.getNode(id);
          if (node) {
            entities.push({
              id: node.id,
              kind: 'node',
              type: node.type,
              name: node.name,
              provenance: node.provenance,
              properties: node.properties,
            });
            continue;
          }

          const edge = this.graph.getEdge(id);
          if (edge) {
            entities.push({
              id: edge.id,
              kind: 'edge',
              type: edge.type,
              source_id: edge.source_id,
              target_id: edge.target_id,
              provenance: edge.provenance,
              permission: edge.permission,
            });
          }
        }

        // Correlate with raw source sync records
        const matchingRawEvidence = this.rawEvidence.filter((r) =>
          validated.entity_ids.some(
            (id) =>
              (r.payload && (
                id === r.payload.user_id ||
                id === r.payload.email ||
                id === r.payload.repo_name
              )) ||
              (typeof r.id === 'string' && r.id.includes(id)) ||
              (typeof (r as any).record_id === 'string' && (r as any).record_id.includes(id))
          )
        );

        // Evaluate freshness for returned entities
        const freshnessEvaluator = new FreshnessEvaluator();
        const freshnessSummary = entities.map((entity) => {
          const prov = (entity.provenance as { observed_at?: string }) || {};
          const observedAt = prov.observed_at ? new Date(prov.observed_at) : new Date(0);
          const ageDays = (new Date('2026-10-10T00:00:00Z').getTime() - observedAt.getTime()) / (1000 * 60 * 60 * 24);
          return {
            entity_id: entity.id,
            age_days: Math.max(0, Math.round(ageDays)),
            is_stale: ageDays > 30,
          };
        });

        return {
          requested_count: validated.entity_ids.length,
          found_count: entities.length,
          entities,
          raw_source_records: matchingRawEvidence,
          freshness: freshnessSummary,
        };
      }

      case 'simulate_edge_removal': {
        const validated = SimulateEdgeRemovalInputSchema.parse(args);
        const simulator = new CounterfactualSimulator(this.graph);

        const result = simulator.simulateEdgeRemoval({
          candidateEdgeId: validated.candidate_edge_id,
          identityId: validated.source_id,
          targetId: validated.target_id,
          peerIds: validated.peer_identity_ids,
          maxHops: validated.max_hops,
        });

        return result;
      }

      case 'create_remediation_draft': {
        const validated = CreateRemediationDraftInputSchema.parse(args);
        const draft = this.draftStore.createDraft(validated);
        return draft;
      }

      case 'falkordb_cypher_query': {
        const validated = FalkorDBCypherQueryInputSchema.parse(args);
        const falkor = getFalkorDBService();
        return await falkor.query(validated.cypher, validated.params as any, this.graph);
      }

      default:
        throw new Error(`Unknown MCP Tool: '${toolName}'`);
    }
  }

  private logToolCall(
    toolName: string,
    scope: ToolScope,
    rawInput: Record<string, unknown>,
    status: 'success' | 'error',
    durationMs: number,
    errorMessage?: string
  ): void {
    this.logCounter += 1;
    // Sanitize credentials / sensitive fields if any exist
    const sanitizedInput = { ...rawInput };
    if ('password' in sanitizedInput) delete sanitizedInput.password;
    if ('secret' in sanitizedInput) delete sanitizedInput.secret;
    if ('token' in sanitizedInput) delete sanitizedInput.token;

    this.auditLogs.push({
      id: `audit_log_${this.logCounter}`,
      timestamp: new Date().toISOString(),
      tool_name: toolName,
      scope,
      sanitized_input: sanitizedInput,
      status,
      duration_ms: durationMs,
      error_message: errorMessage,
    });
  }
}
