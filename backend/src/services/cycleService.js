const { FileNode, DependencyEdge } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Groups the latest analysis's cycle edges (isPartOfCycle: true) by cycleId
 * into ordered file chains (A -> B -> C -> A), each with the specific
 * imported names crossing every edge plus per-file facts (LOC, complexity)
 * for grounding the "explain this cycle" AI prompt.
 *
 * The DB only stores a flat, tagged edge list — not the walk order — so the
 * chain is reconstructed here from the adjacency within each cycleId group.
 * Every node in a simple cycle has exactly one outgoing edge inside its own
 * group, so starting anywhere and following sourcePath -> targetPath always
 * retraces the original loop.
 */
async function getCyclesForAnalysis(repository) {
  if (!repository.latestAnalysisJob) return [];

  const cycleEdges = await DependencyEdge.find({
    analysisJob: repository.latestAnalysisJob,
    isPartOfCycle: true,
  }).select('sourcePath targetPath importedNames cycleId');

  if (!cycleEdges.length) return [];

  const byCycle = new Map();
  for (const edge of cycleEdges) {
    const id = edge.cycleId || 'unknown';
    if (!byCycle.has(id)) byCycle.set(id, []);
    byCycle.get(id).push(edge);
  }

  const filePaths = new Set();
  for (const edge of cycleEdges) {
    filePaths.add(edge.sourcePath);
    filePaths.add(edge.targetPath);
  }

  const files = await FileNode.find({
    analysisJob: repository.latestAnalysisJob,
    filePath: { $in: [...filePaths] },
  }).select('filePath linesOfCode averageComplexity maxComplexity fileComplexity');
  const fileByPath = new Map(files.map((f) => [f.filePath, f]));

  const cycles = [...byCycle.entries()].map(([cycleId, edges]) => buildCycleChain(cycleId, edges, fileByPath));

  // Surface the more consequential (longer) cycles first.
  cycles.sort((a, b) => b.files.length - a.files.length);
  return cycles;
}

function buildCycleChain(cycleId, edges, fileByPath) {
  const bySource = new Map(edges.map((e) => [e.sourcePath, e]));

  const start = edges[0].sourcePath;
  const orderedEdges = [];
  let current = start;
  const guard = edges.length + 1; // avoid infinite loop if data is ever malformed
  for (let i = 0; i < guard; i += 1) {
    const edge = bySource.get(current);
    if (!edge) break;
    orderedEdges.push(edge);
    current = edge.targetPath;
    if (current === start) break;
  }

  const chainFiles = [orderedEdges[0]?.sourcePath, ...orderedEdges.map((e) => e.targetPath)].filter(Boolean);

  return {
    cycleId,
    files: chainFiles,
    length: orderedEdges.length,
    edges: orderedEdges.map((e) => ({
      sourcePath: e.sourcePath,
      targetPath: e.targetPath,
      importedNames: e.importedNames || [],
    })),
    fileFacts: chainFiles.map((filePath) => {
      const f = fileByPath.get(filePath);
      return {
        filePath,
        linesOfCode: f?.linesOfCode ?? null,
        averageComplexity: f?.averageComplexity ?? null,
        maxComplexity: f?.maxComplexity ?? null,
        fileComplexity: f?.fileComplexity ?? null,
      };
    }),
  };
}

async function getCycleById(repository, cycleId) {
  const cycles = await getCyclesForAnalysis(repository);
  const cycle = cycles.find((c) => c.cycleId === cycleId);
  if (!cycle) throw ApiError.notFound(`Cycle not found in the latest analysis: ${cycleId}`);
  return cycle;
}

module.exports = { getCyclesForAnalysis, getCycleById };
