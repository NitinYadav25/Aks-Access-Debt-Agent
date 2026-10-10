import {
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
} from './types';

export class InMemoryAccessGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private outgoing: Map<string, GraphEdge[]> = new Map();
  private incoming: Map<string, GraphEdge[]> = new Map();

  constructor(nodes: GraphNode[] = [], edges: GraphEdge[] = []) {
    for (const node of nodes) {
      this.addNode(node);
    }
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.outgoing.has(node.id)) {
      this.outgoing.set(node.id, []);
    }
    if (!this.incoming.has(node.id)) {
      this.incoming.set(node.id, []);
    }
  }

  public addEdge(edge: GraphEdge): void {
    // Validate that source and target nodes exist or instantiate buckets
    this.edges.set(edge.id, edge);

    if (!this.outgoing.has(edge.source_id)) {
      this.outgoing.set(edge.source_id, []);
    }
    this.outgoing.get(edge.source_id)!.push(edge);

    if (!this.incoming.has(edge.target_id)) {
      this.incoming.set(edge.target_id, []);
    }
    this.incoming.get(edge.target_id)!.push(edge);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  public getOutgoingEdges(nodeId: string, filterType?: EdgeType): GraphEdge[] {
    const list = this.outgoing.get(nodeId) || [];
    if (!filterType) return list;
    return list.filter((e) => e.type === filterType);
  }

  public getIncomingEdges(nodeId: string, filterType?: EdgeType): GraphEdge[] {
    const list = this.incoming.get(nodeId) || [];
    if (!filterType) return list;
    return list.filter((e) => e.type === filterType);
  }

  public getSchema(): {
    nodeTypes: NodeType[];
    edgeTypes: EdgeType[];
    totalNodes: number;
    totalEdges: number;
    tenantBoundary: string;
  } {
    const nodeTypes = Array.from(new Set(Array.from(this.nodes.values()).map((n) => n.type)));
    const edgeTypes = Array.from(new Set(Array.from(this.edges.values()).map((e) => e.type)));
    const sampleTenant = this.nodes.values().next().value?.tenant_id || 'default_tenant';

    return {
      nodeTypes,
      edgeTypes,
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      tenantBoundary: sampleTenant,
    };
  }

  /**
   * Clone graph with one edge excluded for counterfactual simulation.
   */
  public cloneWithoutEdge(excludedEdgeId: string): InMemoryAccessGraph {
    const remainingEdges = Array.from(this.edges.values()).filter(
      (e) => e.id !== excludedEdgeId
    );
    return new InMemoryAccessGraph(this.getAllNodes(), remainingEdges);
  }
}
