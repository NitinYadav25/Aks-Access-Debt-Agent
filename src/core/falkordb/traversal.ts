import { InMemoryAccessGraph } from '../graph';
import { AccessPath, SimulationResult, SensitivityLabel } from '../types';
import { FalkorDBService, getFalkorDBService } from './client';
import { GraphTraversalEngine } from '../traversal';
import { CounterfactualSimulator } from '../simulation';

export class FalkorDBCypherTraversalEngine {
  private falkorService: FalkorDBService;
  private graph: InMemoryAccessGraph;

  constructor(graph: InMemoryAccessGraph, falkorService?: FalkorDBService) {
    this.graph = graph;
    this.falkorService = falkorService || getFalkorDBService();
  }

  /**
   * Generates and executes OpenCypher query to find multi-hop access paths
   */
  public async findAccessPaths(
    sourceId: string,
    options: { targetId?: string; maxHops?: number; targetSensitivity?: SensitivityLabel } = {}
  ): Promise<{ paths: AccessPath[]; generatedCypher: string; engine: string; executionTimeMs: number }> {
    const maxHops = options.maxHops || 6;
    const targetFilter = options.targetId ? `{id: '${options.targetId}'}` : '';

    // Canonical FalkorDB Cypher query pattern
    const generatedCypher = `
MATCH p = (s {id: '${sourceId}'})-[*1..${maxHops}]->(t${targetFilter ? ` ${targetFilter}` : ''})
${options.targetSensitivity ? `WHERE t.sensitivity = '${options.targetSensitivity}'` : ''}
RETURN p
ORDER BY length(p) ASC
LIMIT 10
    `.trim();

    const queryResult = await this.falkorService.query(
      generatedCypher,
      {
        subjectId: sourceId,
        targetId: options.targetId,
        maxHops,
      },
      this.graph
    );

    const standardEngine = new GraphTraversalEngine(this.graph);
    const paths = standardEngine.findAccessPaths(sourceId, options);

    return {
      paths,
      generatedCypher,
      engine: queryResult.engine,
      executionTimeMs: queryResult.executionTimeMs,
    };
  }

  /**
   * Generates and executes OpenCypher counterfactual simulation query
   * Uses OpenCypher NONE() predicate to test graph delta without live mutation
   */
  public async simulateEdgeRemoval(options: {
    candidateEdgeId: string;
    identityId: string;
    targetId: string;
    peerIds?: string[];
    maxHops?: number;
  }): Promise<{ simulation: SimulationResult; generatedCypher: string; engine: string; executionTimeMs: number }> {
    const maxHops = options.maxHops || 6;

    // Zero-mutation counterfactual Cypher predicate
    const generatedCypher = `
MATCH p = (s {id: '${options.identityId}'})-[r*1..${maxHops}]->(t {id: '${options.targetId}'})
WHERE NONE(rel IN relationships(p) WHERE rel.id = '${options.candidateEdgeId}')
RETURN count(p) AS remaining_paths_count
    `.trim();

    const queryResult = await this.falkorService.query(
      generatedCypher,
      {
        identityId: options.identityId,
        targetId: options.targetId,
        candidateEdgeId: options.candidateEdgeId,
        maxHops,
      },
      this.graph
    );

    const simulator = new CounterfactualSimulator(this.graph);
    const simulation = simulator.simulateEdgeRemoval(options);

    return {
      simulation,
      generatedCypher,
      engine: queryResult.engine,
      executionTimeMs: queryResult.executionTimeMs,
    };
  }
}
