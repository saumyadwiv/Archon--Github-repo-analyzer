/**
 * Detects circular dependencies in a directed graph using DFS with node
 * coloring (white = unvisited, gray = on current DFS stack, black = fully
 * explored). A back-edge (gray -> gray) means a cycle; we extract the cycle
 * path from the current stack.
 *
 * Input: edges = [{ sourcePath, targetPath, ... }]
 * Output: {
 *   cycles: [ { id, files: [filePath, ...] } ],   // each cycle as an ordered path
 *   filesInCycles: Set<filePath>,
 *   edgesInCycles: Set<"source=>target">
 * }
 */
function detectCircularDependencies(edges) {
  const adjacency = new Map(); // filePath -> [filePath, ...]
  for (const edge of edges) {
    if (!adjacency.has(edge.sourcePath)) adjacency.set(edge.sourcePath, []);
    adjacency.get(edge.sourcePath).push(edge.targetPath);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  const stack = [];
  const cycles = [];
  const filesInCycles = new Set();
  const edgesInCycles = new Set();
  const seenCycleSignatures = new Set(); // avoid reporting the same cycle repeatedly

  function dfs(node) {
    color.set(node, GRAY);
    stack.push(node);

    for (const neighbor of adjacency.get(node) || []) {
      const neighborColor = color.get(neighbor) || WHITE;

      if (neighborColor === WHITE) {
        dfs(neighbor);
      } else if (neighborColor === GRAY) {
        // Found a back-edge: extract the cycle from the stack
        const cycleStartIdx = stack.indexOf(neighbor);
        if (cycleStartIdx !== -1) {
          const cyclePath = stack.slice(cycleStartIdx);
          const signature = [...cyclePath].sort().join('|');
          if (!seenCycleSignatures.has(signature)) {
            seenCycleSignatures.add(signature);
            const cycleId = `cycle_${cycles.length + 1}`;
            cycles.push({ id: cycleId, files: [...cyclePath, neighbor] });

            for (const f of cyclePath) filesInCycles.add(f);
            filesInCycles.add(neighbor);

            for (let i = 0; i < cyclePath.length; i += 1) {
              const from = cyclePath[i];
              const to = cyclePath[i + 1] || neighbor;
              edgesInCycles.add(`${from}=>${to}`);
            }
          }
        }
      }
      // BLACK neighbors are already fully explored — no cycle through them from here
    }

    stack.pop();
    color.set(node, BLACK);
  }

  // Run DFS from every node to catch cycles in disconnected subgraphs
  const allNodes = new Set();
  for (const edge of edges) {
    allNodes.add(edge.sourcePath);
    allNodes.add(edge.targetPath);
  }
  for (const node of allNodes) {
    if ((color.get(node) || WHITE) === WHITE) {
      dfs(node);
    }
  }

  return { cycles, filesInCycles, edgesInCycles };
}

module.exports = { detectCircularDependencies };
