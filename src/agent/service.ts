import { loadSyntheticFixtures } from '../core/loader';
import { AksMcpServer } from '../mcp/server';
import { AksMcpClient } from '../mcp/client';
import { AksAgentOrchestrator } from './orchestrator';
import { GraphIngestionEngine, IngestPayload, IngestResult } from '../core/ingest';
import { getEnterpriseDataset } from '../core/enterprise-dataset';
import { InMemoryAccessGraph } from '../core/graph';
import { RawEvidenceRecord } from '../core/types';
import { FalkorDBService, getFalkorDBService } from '../core/falkordb/client';
import { FalkorDBCypherTraversalEngine } from '../core/falkordb/traversal';

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  identitiesCount: number;
  contractorsCount: number;
  serviceAccountsCount: number;
  groupsCount: number;
  rolesCount: number;
  repositoriesCount: number;
  cloudResourcesCount: number;
  highSensitivityCount: number;
  mediumSensitivityCount: number;
  lowSensitivityCount: number;
  systemsBreakdown: Record<string, number>;
  activeDataset: 'enterprise' | 'baseline' | 'custom';
  lastIngestedAt: string;
}

// Singleton service container for Next.js API routes and server components
export class AksServiceContainer {
  private static instance: AksServiceContainer;
  public server!: AksMcpServer;
  public client!: AksMcpClient;
  public orchestrator!: AksAgentOrchestrator;
  public fixtures: ReturnType<typeof loadSyntheticFixtures>;
  public falkor: FalkorDBService;
  private activeDataset: 'enterprise' | 'baseline' | 'custom' = 'enterprise';
  private lastIngestedAt: string = new Date().toISOString();

  private constructor() {
    this.fixtures = loadSyntheticFixtures();
    this.falkor = getFalkorDBService();
    // Initialize with rich real enterprise dataset by default
    this.loadEnterpriseData();
  }

  public static getInstance(): AksServiceContainer {
    if (!AksServiceContainer.instance) {
      AksServiceContainer.instance = new AksServiceContainer();
    }
    return AksServiceContainer.instance;
  }

  /**
   * Loads rich real enterprise multi-cloud dataset (Acme Cloud Technologies)
   */
  public loadEnterpriseData(): void {
    const { nodes, edges, evidence } = getEnterpriseDataset();
    const graph = new InMemoryAccessGraph(nodes, edges);

    this.server = new AksMcpServer({
      graph,
      rawEvidence: evidence,
    });
    this.client = new AksMcpClient(this.server);
    this.orchestrator = new AksAgentOrchestrator({
      mcpClient: this.client,
      graph,
      rawEvidence: evidence,
    });
    this.activeDataset = 'enterprise';
    this.lastIngestedAt = new Date().toISOString();
  }

  /**
   * Resets graph to clean baseline fixtures
   */
  public resetToBaseline(): void {
    this.fixtures = loadSyntheticFixtures();
    this.server = new AksMcpServer({
      graph: this.fixtures.graph,
      rawEvidence: this.fixtures.rawEvidence,
    });
    this.client = new AksMcpClient(this.server);
    this.orchestrator = new AksAgentOrchestrator({
      mcpClient: this.client,
      graph: this.fixtures.graph,
      rawEvidence: this.fixtures.rawEvidence,
    });
    this.activeDataset = 'baseline';
    this.lastIngestedAt = new Date().toISOString();
  }

  /**
   * Ingest custom nodes, edges, or provider connector dumps into active graph
   */
  public ingestPayload(payload: IngestPayload): IngestResult {
    // Current graph and evidence
    const currentGraph = (this.server as any).graph as InMemoryAccessGraph;
    const currentEvidence = (this.server as any).rawEvidence as RawEvidenceRecord[];

    const result = GraphIngestionEngine.ingest(currentGraph, currentEvidence, payload);

    // Refresh client and orchestrator bindings
    this.client = new AksMcpClient(this.server);
    this.orchestrator = new AksAgentOrchestrator({
      mcpClient: this.client,
      graph: currentGraph,
      rawEvidence: currentEvidence,
    });
    this.activeDataset = 'custom';
    this.lastIngestedAt = new Date().toISOString();

    return result;
  }

  /**
   * Compute comprehensive real-time statistics of the active graph
   */
  public getStats(): GraphStats {
    const graph = (this.server as any).graph as InMemoryAccessGraph;
    const allNodes = graph.getAllNodes();
    const allEdges = graph.getAllEdges();

    let identitiesCount = 0;
    let contractorsCount = 0;
    let serviceAccountsCount = 0;
    let groupsCount = 0;
    let rolesCount = 0;
    let repositoriesCount = 0;
    let cloudResourcesCount = 0;
    let highSensitivityCount = 0;
    let mediumSensitivityCount = 0;
    let lowSensitivityCount = 0;

    const systemsBreakdown: Record<string, number> = {
      github: 0,
      aws_iam: 0,
      okta: 0,
      workday: 0,
      custom: 0,
    };

    for (const node of allNodes) {
      if (node.type === 'Identity') {
        identitiesCount++;
        if (node.properties.is_contractor) contractorsCount++;
        if (node.properties.is_service_account) serviceAccountsCount++;
      } else if (node.type === 'Group') {
        groupsCount++;
      } else if (node.type === 'Role') {
        rolesCount++;
      } else if (node.type === 'Repository') {
        repositoriesCount++;
      } else if (node.type === 'CloudResource') {
        cloudResourcesCount++;
      }

      const sens = node.properties.sensitivity_label;
      if (sens === 'high') highSensitivityCount++;
      else if (sens === 'medium') mediumSensitivityCount++;
      else if (sens === 'low') lowSensitivityCount++;

      const sys = node.provenance?.source_system || 'custom';
      systemsBreakdown[sys] = (systemsBreakdown[sys] || 0) + 1;
    }

    return {
      totalNodes: allNodes.length,
      totalEdges: allEdges.length,
      identitiesCount,
      contractorsCount,
      serviceAccountsCount,
      groupsCount,
      rolesCount,
      repositoriesCount,
      cloudResourcesCount,
      highSensitivityCount,
      mediumSensitivityCount,
      lowSensitivityCount,
      systemsBreakdown,
      activeDataset: this.activeDataset,
      lastIngestedAt: this.lastIngestedAt,
    };
  }

  public getGraph(): InMemoryAccessGraph {
    return (this.server as any).graph as InMemoryAccessGraph;
  }

  public getRawEvidence(): RawEvidenceRecord[] {
    return (this.server as any).rawEvidence as RawEvidenceRecord[];
  }

  public getFalkorService(): FalkorDBService {
    return this.falkor;
  }

  public getFalkorTraversal(): FalkorDBCypherTraversalEngine {
    return new FalkorDBCypherTraversalEngine(this.getGraph(), this.falkor);
  }
}

export function getAksService(): AksServiceContainer {
  return AksServiceContainer.getInstance();
}

