import { InMemoryAccessGraph } from './graph';
import { GraphNode, GraphEdge, RawEvidenceRecord, ScenarioDefinition } from './types';
import nodesData from '../../fixtures/graph_nodes.json';
import edgesData from '../../fixtures/graph_edges.json';
import evidenceData from '../../fixtures/evidence_records.json';
import scenariosData from '../../fixtures/scenarios.json';

export interface LoadedFixtures {
  graph: InMemoryAccessGraph;
  rawNodes: GraphNode[];
  rawEdges: GraphEdge[];
  rawEvidence: RawEvidenceRecord[];
  scenarios: ScenarioDefinition[];
}

/**
 * Loads synthetic fixture data and initializes the in-memory access graph.
 */
export function loadSyntheticFixtures(): LoadedFixtures {
  const rawNodes = nodesData as unknown as GraphNode[];
  const rawEdges = edgesData as unknown as GraphEdge[];
  const rawEvidence = evidenceData as unknown as RawEvidenceRecord[];
  const scenarios = scenariosData as unknown as ScenarioDefinition[];

  const graph = new InMemoryAccessGraph(rawNodes, rawEdges);

  return {
    graph,
    rawNodes,
    rawEdges,
    rawEvidence,
    scenarios,
  };
}
