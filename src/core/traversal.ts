import { InMemoryAccessGraph } from './graph';
import { AccessPath, GraphEdge, GraphNode, SensitivityLabel } from './types';

export interface TraversalOptions {
  maxHops?: number;
  maxPaths?: number;
  targetId?: string;
  targetSensitivity?: SensitivityLabel;
  validEdgeTypes?: string[];
}

export class GraphTraversalEngine {
  private graph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph) {
    this.graph = graph;
  }

  /**
   * Find access paths from a source identity/node to sensitive targets or a specific target.
   */
  public findAccessPaths(
    sourceId: string,
    options: TraversalOptions = {}
  ): AccessPath[] {
    const maxHops = options.maxHops ?? 6;
    const maxPaths = options.maxPaths ?? 50;
    const targetId = options.targetId;
    const targetSensitivity = options.targetSensitivity;

    const sourceNode = this.graph.getNode(sourceId);
    if (!sourceNode) {
      return [];
    }

    const paths: AccessPath[] = [];

    // Queue item for BFS traversal
    interface QueueItem {
      currentNodeId: string;
      visitedNodeIds: Set<string>;
      edgesInPath: GraphEdge[];
      nodesInPath: GraphNode[];
    }

    const queue: QueueItem[] = [
      {
        currentNodeId: sourceId,
        visitedNodeIds: new Set([sourceId]),
        edgesInPath: [],
        nodesInPath: [sourceNode],
      },
    ];

    while (queue.length > 0 && paths.length < maxPaths) {
      const current = queue.shift()!;
      const currentHop = current.edgesInPath.length;

      // Check if current node is a valid target destination
      if (currentHop > 0) {
        const currentNode = current.nodesInPath[current.nodesInPath.length - 1];
        const isTargetMatch =
          (!targetId || currentNode.id === targetId) &&
          (!targetSensitivity ||
            currentNode.properties.sensitivity_label === targetSensitivity);

        // A valid destination is typically a Repository or CloudResource
        const isResourceNode =
          currentNode.type === 'Repository' || currentNode.type === 'CloudResource';

        if (isTargetMatch && (targetId || isResourceNode)) {
          paths.push({
            path_id: `path_${sourceId}_to_${currentNode.id}_${paths.length + 1}`,
            nodes: [...current.nodesInPath],
            edges: [...current.edgesInPath],
            hop_count: currentHop,
            source_id: sourceId,
            target_id: currentNode.id,
          });

          // If we are looking for a specific target and found it on this branch, stop extending this branch
          if (targetId && currentNode.id === targetId) {
            continue;
          }
        }
      }

      // If we reached max hops, stop expanding this branch
      if (currentHop >= maxHops) {
        continue;
      }

      // Expand outgoing edges
      const outgoingEdges = this.graph.getOutgoingEdges(current.currentNodeId);
      for (const edge of outgoingEdges) {
        // Prevent cycles
        if (current.visitedNodeIds.has(edge.target_id)) {
          continue;
        }

        const nextNode = this.graph.getNode(edge.target_id);
        if (!nextNode) {
          continue;
        }

        const newVisited = new Set(current.visitedNodeIds);
        newVisited.add(edge.target_id);

        queue.push({
          currentNodeId: edge.target_id,
          visitedNodeIds: newVisited,
          edgesInPath: [...current.edgesInPath, edge],
          nodesInPath: [...current.nodesInPath, nextNode],
        });
      }
    }

    // Sort paths by hop count (shortest/simplest first)
    return paths.sort((a, b) => a.hop_count - b.hop_count);
  }

  /**
   * Determine reachability boolean between source and target.
   */
  public isReachable(sourceId: string, targetId: string, maxHops: number = 6): boolean {
    const paths = this.findAccessPaths(sourceId, {
      targetId,
      maxHops,
      maxPaths: 1,
    });
    return paths.length > 0;
  }
}
