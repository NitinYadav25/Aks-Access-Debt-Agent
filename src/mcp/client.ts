import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AksMcpServer } from './server';
import { ToolAuditLog } from './types';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export class AksMcpClient {
  private client: Client;
  private serverInstance: AksMcpServer;
  private connected = false;

  constructor(server: AksMcpServer) {
    this.serverInstance = server;
    this.client = new Client(
      {
        name: 'aks-agent-client',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect client to server using high-speed in-memory transport.
   */
  public async connect(): Promise<void> {
    if (this.connected) return;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      this.serverInstance.getRawServer().connect(serverTransport),
      this.client.connect(clientTransport),
    ]);

    this.connected = true;
  }

  /**
   * Discover tools via standard MCP tools/list protocol request.
   */
  public async listTools(): Promise<McpToolDefinition[]> {
    if (!this.connected) {
      await this.connect();
    }

    const response = await this.client.listTools();
    return response.tools as McpToolDefinition[];
  }

  /**
   * Invoke a tool via standard MCP tools/call protocol request.
   */
  public async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected) {
      await this.connect();
    }

    const response = await this.client.callTool({
      name,
      arguments: args,
    });

    const contentList = Array.isArray(response.content) ? (response.content as Array<{ type: string; text?: string }>) : [];

    if (response.isError) {
      const errorContent = contentList[0];
      const errorMsg = errorContent?.text || 'Unknown MCP tool error';
      throw new Error(`MCP Tool '${name}' returned error: ${errorMsg}`);
    }

    const firstContent = contentList[0];
    if (firstContent?.text) {
      return JSON.parse(firstContent.text) as T;
    }

    return response as unknown as T;
  }

  public getAuditLogs(): ToolAuditLog[] {
    return this.serverInstance.getAuditLogs();
  }
}
