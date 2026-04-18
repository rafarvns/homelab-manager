// ============================================================
// Graph Traversal — BFS-based context expansion
// ============================================================

import type { GraphNode, GraphEdge } from '../types'

/**
 * Expands a seed set of nodes via BFS to include related nodes up to `depth` hops.
 * Deduplicates visited nodes and preserves the original seed nodes at the front.
 */
export function expandContext(
  seedNodes: GraphNode[],
  depth: number,
  getEdges: (nodeId: string) => GraphEdge[],
  getNode: (id: string) => GraphNode | undefined
): GraphNode[] {
  if (depth <= 0 || seedNodes.length === 0) return [...seedNodes]

  const visited = new Set<string>()
  const result: GraphNode[] = []

  // Seed the BFS queue with the initial nodes
  let currentLayer: GraphNode[] = []
  for (const node of seedNodes) {
    if (!visited.has(node.id)) {
      visited.add(node.id)
      result.push(node)
      currentLayer.push(node)
    }
  }

  // BFS layer by layer
  for (let d = 0; d < depth; d++) {
    const nextLayer: GraphNode[] = []

    for (const node of currentLayer) {
      const edges = getEdges(node.id)

      for (const edge of edges) {
        const neighborId = edge.from === node.id ? edge.to : edge.from

        if (!visited.has(neighborId)) {
          const neighbor = getNode(neighborId)
          if (neighbor) {
            visited.add(neighborId)
            result.push(neighbor)
            nextLayer.push(neighbor)
          }
        }
      }
    }

    currentLayer = nextLayer
    if (currentLayer.length === 0) break // no more nodes to expand
  }

  return result
}

/**
 * Returns all direct neighbors of a node (1 hop) with their edge metadata.
 */
export function getNeighbors(
  nodeId: string,
  getEdges: (nodeId: string) => GraphEdge[],
  getNode: (id: string) => GraphNode | undefined
): Array<{ node: GraphNode; edge: GraphEdge }> {
  const edges = getEdges(nodeId)
  const result: Array<{ node: GraphNode; edge: GraphEdge }> = []

  for (const edge of edges) {
    const neighborId = edge.from === nodeId ? edge.to : edge.from
    const node = getNode(neighborId)
    if (node) {
      result.push({ node, edge })
    }
  }

  return result
}
