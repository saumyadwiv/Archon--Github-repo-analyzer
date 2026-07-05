const HIGH_COMPLEXITY_THRESHOLD = 15; // per-function complexity considered "high"
const HIGH_AVG_FILE_COMPLEXITY_THRESHOLD = 10;
const LARGE_FILE_LOC_THRESHOLD = 400;

/**
 * Weighted scoring out of 100:
 *  - complexityScore  (40 pts): penalizes high average/​max cyclomatic complexity
 *  - cycleScore       (30 pts): penalizes circular dependencies
 *  - sizeScore        (15 pts): penalizes oversized files (poor decomposition)
 *  - structureScore   (15 pts): penalizes parse failures / unresolved structure
 */
function computeHealthScore({ fileNodes, cycles, filesInCyclesCount, parseErrorCount }) {
  const totalFiles = fileNodes.length || 1;

  const allFunctions = fileNodes.flatMap((f) => f.functions || []);
  const totalFunctions = allFunctions.length;
  const avgComplexity = totalFunctions
    ? allFunctions.reduce((sum, fn) => sum + fn.cyclomaticComplexity, 0) / totalFunctions
    : 0;
  const maxComplexity = totalFunctions ? Math.max(...allFunctions.map((fn) => fn.cyclomaticComplexity)) : 0;
  const highComplexityFileCount = fileNodes.filter(
    (f) => (f.averageComplexity || 0) > HIGH_AVG_FILE_COMPLEXITY_THRESHOLD
  ).length;

  // --- Complexity score (40 pts) ---
  // Full marks under avg complexity 5; linear falloff to 0 at avg complexity 25+
  const complexityScore = clamp(40 * (1 - (avgComplexity - 5) / 20), 0, 40);

  // --- Cycle score (30 pts) ---
  // Full marks with 0 cycles; each cycle costs points, floor at 0
  const cycleCount = cycles.length;
  const cycleRatio = filesInCyclesCount / totalFiles;
  const cycleScore = clamp(30 - cycleCount * 6 - cycleRatio * 30, 0, 30);

  // --- Size score (15 pts) ---
  const largeFileCount = fileNodes.filter((f) => f.linesOfCode > LARGE_FILE_LOC_THRESHOLD).length;
  const largeFileRatio = largeFileCount / totalFiles;
  const sizeScore = clamp(15 * (1 - largeFileRatio * 2), 0, 15);

  // --- Structure score (15 pts) ---
  const parseErrorRatio = parseErrorCount / totalFiles;
  const structureScore = clamp(15 * (1 - parseErrorRatio * 4), 0, 15);

  const healthScore = Math.round(complexityScore + cycleScore + sizeScore + structureScore);
  const healthGrade = scoreToGrade(healthScore);

  const topComplexFiles = [...fileNodes]
    .sort((a, b) => (b.fileComplexity || 0) - (a.fileComplexity || 0))
    .slice(0, 10)
    .map((f) => ({ filePath: f.filePath, complexity: f.fileComplexity || 0 }));

  return {
    totalFiles: fileNodes.length,
    totalFunctions,
    averageComplexity: round2(avgComplexity),
    maxComplexity,
    highComplexityFileCount,
    circularDependencyCount: cycleCount,
    filesInCycles: filesInCyclesCount,
    healthScore,
    healthGrade,
    scoreBreakdown: {
      complexityScore: round2(complexityScore),
      cycleScore: round2(cycleScore),
      sizeScore: round2(sizeScore),
      structureScore: round2(structureScore),
    },
    topComplexFiles,
  };
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { computeHealthScore, HIGH_COMPLEXITY_THRESHOLD, LARGE_FILE_LOC_THRESHOLD };
