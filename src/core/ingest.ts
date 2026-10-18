import { InMemoryAccessGraph } from './graph';
import { GraphNode, GraphEdge, RawEvidenceRecord, NodeType, EdgeType } from './types';
import { parseGitHubOrgExport } from './connectors/github';
import { parseAwsIamExport } from './connectors/aws';
import { parseOktaExport } from './connectors/okta';
import { GitHubOrgExport, AwsIamExport, OktaExport } from './connectors/types';

export interface IngestPayload {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  evidence?: RawEvidenceRecord[];
  githubExport?: GitHubOrgExport;
  awsExport?: AwsIamExport;
  oktaExport?: OktaExport;
  tenantId?: string;
  mode?: 'merge' | 'replace';
}

export interface IngestResult {
  success: boolean;
  nodesAdded: number;
  edgesAdded: number;
  evidenceAdded: number;
  totalGraphNodes: number;
  totalGraphEdges: number;
  warnings: string[];
}

const VALID_NODE_TYPES: Set<NodeType> = new Set(['Identity', 'Group', 'Role', 'Repository', 'CloudResource']);
const VALID_EDGE_TYPES: Set<EdgeType> = new Set(['MEMBER_OF', 'NESTED_IN', 'ASSUMES_ROLE', 'GRANTS_ACCESS', 'OWNS']);

export class GraphIngestionEngine {
  /**
   * Ingest arbitrary custom payloads or connector exports into target graph.
   */
  public static ingest(
    targetGraph: InMemoryAccessGraph,
    evidenceStore: RawEvidenceRecord[],
    payload: IngestPayload
  ): IngestResult {
    const warnings: string[] = [];
    const tenantId = payload.tenantId || 'tenant_demo_corp';
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    const newEvidence: RawEvidenceRecord[] = [];

    // 1. Process Direct Custom Nodes & Edges
    if (payload.nodes && Array.isArray(payload.nodes)) {
      for (const n of payload.nodes) {
        if (!n.id || !n.name || !n.type) {
          warnings.push(`Skipping invalid node without id/name/type: ${JSON.stringify(n)}`);
          continue;
        }
        if (!VALID_NODE_TYPES.has(n.type as NodeType)) {
          warnings.push(`Unknown node type '${n.type}' for node '${n.id}'. Coercing to 'Identity'`);
          n.type = 'Identity';
        }
        if (!n.provenance) {
          n.provenance = {
            source_system: 'custom' as unknown as any,
            source_record_id: `rec_${n.id}`,
            observed_at: new Date().toISOString(),
            confidence: 0.95,
          };
        }
        if (!n.tenant_id) {
          n.tenant_id = tenantId;
        }
        newNodes.push(n);
      }
    }

    if (payload.edges && Array.isArray(payload.edges)) {
      for (const e of payload.edges) {
        if (!e.id || !e.source_id || !e.target_id || !e.type) {
          warnings.push(`Skipping invalid edge without id/source/target/type: ${JSON.stringify(e)}`);
          continue;
        }
        if (!VALID_EDGE_TYPES.has(e.type as EdgeType)) {
          warnings.push(`Unknown edge type '${e.type}' for edge '${e.id}'. Defaulting to 'GRANTS_ACCESS'`);
          e.type = 'GRANTS_ACCESS';
        }
        if (!e.provenance) {
          e.provenance = {
            source_system: 'custom' as unknown as any,
            source_record_id: `rec_edge_${e.id}`,
            observed_at: new Date().toISOString(),
            confidence: 0.95,
          };
        }
        newEdges.push(e);
      }
    }

    if (payload.evidence && Array.isArray(payload.evidence)) {
      newEvidence.push(...payload.evidence);
    }

    // 2. Process GitHub Connector Export
    if (payload.githubExport) {
      try {
        const ghResult = parseGitHubOrgExport(payload.githubExport, tenantId);
        newNodes.push(...ghResult.nodes);
        newEdges.push(...ghResult.edges);
        newEvidence.push(...ghResult.evidence);
      } catch (err) {
        warnings.push(`GitHub ingestion error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Process AWS IAM Export
    if (payload.awsExport) {
      try {
        const awsResult = parseAwsIamExport(payload.awsExport, tenantId);
        newNodes.push(...awsResult.nodes);
        newEdges.push(...awsResult.edges);
        newEvidence.push(...awsResult.evidence);
      } catch (err) {
        warnings.push(`AWS IAM ingestion error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 4. Process Okta Export
    if (payload.oktaExport) {
      try {
        const oktaResult = parseOktaExport(payload.oktaExport, tenantId);
        newNodes.push(...oktaResult.nodes);
        newEdges.push(...oktaResult.edges);
        newEvidence.push(...oktaResult.evidence);
      } catch (err) {
        warnings.push(`Okta ingestion error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 5. Apply to Graph
    let nodesAdded = 0;
    let edgesAdded = 0;

    for (const node of newNodes) {
      targetGraph.addNode(node);
      nodesAdded++;
    }

    for (const edge of newEdges) {
      // Auto-create stub nodes if endpoints do not exist yet
      if (!targetGraph.getNode(edge.source_id)) {
        targetGraph.addNode({
          id: edge.source_id,
          type: 'Identity',
          name: edge.source_id,
          tenant_id: tenantId,
          properties: { status: 'active' },
          provenance: edge.provenance,
        });
        nodesAdded++;
      }
      if (!targetGraph.getNode(edge.target_id)) {
        targetGraph.addNode({
          id: edge.target_id,
          type: 'Repository',
          name: edge.target_id,
          tenant_id: tenantId,
          properties: { sensitivity_label: 'medium' },
          provenance: edge.provenance,
        });
        nodesAdded++;
      }

      targetGraph.addEdge(edge);
      edgesAdded++;
    }

    // Apply evidence
    evidenceStore.push(...newEvidence);

    const schema = targetGraph.getSchema();

    return {
      success: true,
      nodesAdded,
      edgesAdded,
      evidenceAdded: newEvidence.length,
      totalGraphNodes: schema.totalNodes,
      totalGraphEdges: schema.totalEdges,
      warnings,
    };
  }
}
