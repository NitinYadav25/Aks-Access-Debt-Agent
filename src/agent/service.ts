import { loadSyntheticFixtures } from '../core/loader';
import { AksMcpServer } from '../mcp/server';
import { AksMcpClient } from '../mcp/client';
import { AksAgentOrchestrator } from './orchestrator';

// Singleton service container for Next.js API routes and server components
class AksServiceContainer {
  private static instance: AksServiceContainer;
  public server: AksMcpServer;
  public client: AksMcpClient;
  public orchestrator: AksAgentOrchestrator;
  public fixtures: ReturnType<typeof loadSyntheticFixtures>;

  private constructor() {
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
  }

  public static getInstance(): AksServiceContainer {
    if (!AksServiceContainer.instance) {
      AksServiceContainer.instance = new AksServiceContainer();
    }
    return AksServiceContainer.instance;
  }
}

export function getAksService(): AksServiceContainer {
  return AksServiceContainer.getInstance();
}
