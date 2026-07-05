const { FileNode, DependencyEdge, MetricsSnapshot } = require('../models');
const { buildArchitecture, renderArchitectureSummary } = require('./architectureService');

// Repo-context strings are rebuilt from Mongo on cache miss and reused across
// chat turns / explain calls for the same analysis run, keyed by analysisJob id.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // analysisJobId -> { text, expiresAt }

const MAX_LISTED_FILES = 120;
const MAX_TOP_COMPLEX = 12;
const MAX_ENTRY_POINTS = 15;
const MAX_CYCLES_SHOWN = 6;

/**
 * Builds (or returns cached) a compact plain-text summary of a repository's
 * latest analysis: health, structure, complexity hot-spots and circular
 * dependencies. This is fed to Gemini as grounding context so "explain this
 * file" and repo chat answers are actually about the analyzed graph instead
 * of generic guesses.
 */
async function getRepoContext(repository) {
  if (!repository.latestAnalysisJob) return null;

  const jobId = repository.latestAnalysisJob.toString();
  const cached = cache.get(jobId);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const [files, edges, metrics] = await Promise.all([
    FileNode.find({ analysisJob: repository.latestAnalysisJob }).select(
      'filePath fileName language linesOfCode averageComplexity inCycle isEntryPoint functions parseError'
    ),
    DependencyEdge.find({ analysisJob: repository.latestAnalysisJob }).select(
      'sourcePath targetPath isPartOfCycle cycleId'
    ),
    repository.latestMetricsSnapshot ? MetricsSnapshot.findById(repository.latestMetricsSnapshot) : null,
  ]);

  const text = renderContext(repository, files, edges, metrics);
  cache.set(jobId, { text, expiresAt: Date.now() + CACHE_TTL_MS });
  return text;
}

/** Call after a re-analysis completes so stale context isn't served to the AI. */
function invalidate(analysisJobId) {
  if (analysisJobId) cache.delete(analysisJobId.toString());
}

function renderContext(repository, files, edges, metrics) {
  const lines = [];

  lines.push(`Repository: ${repository.fullName}`);
  if (repository.description) lines.push(`Description: ${repository.description}`);
  if (repository.primaryLanguage) lines.push(`Primary language: ${repository.primaryLanguage}`);
  lines.push(`Default branch: ${repository.defaultBranch || 'main'}`);

  if (metrics) {
    lines.push('');
    lines.push('== Health ==');
    lines.push(`Health score: ${metrics.healthScore}/100 (grade ${metrics.healthGrade})`);
    lines.push(
      `Score breakdown — complexity: ${metrics.scoreBreakdown?.complexityScore ?? '?'}/40, ` +
        `cycles: ${metrics.scoreBreakdown?.cycleScore ?? '?'}/30, ` +
        `size: ${metrics.scoreBreakdown?.sizeScore ?? '?'}/15, ` +
        `structure: ${metrics.scoreBreakdown?.structureScore ?? '?'}/15`
    );
    lines.push(
      `Totals: ${metrics.totalFiles} files, ${metrics.totalLinesOfCode} LOC, ${metrics.totalFunctions} functions, ` +
        `${metrics.totalDependencyEdges} dependency edges`
    );
    lines.push(`Average cyclomatic complexity: ${metrics.averageComplexity?.toFixed?.(2) ?? metrics.averageComplexity}`);
    if (metrics.languageBreakdown) {
      const breakdown = Array.from(
        metrics.languageBreakdown instanceof Map
          ? metrics.languageBreakdown.entries()
          : Object.entries(metrics.languageBreakdown)
      )
        .map(([lang, count]) => `${lang}: ${count}`)
        .join(', ');
      if (breakdown) lines.push(`Language breakdown: ${breakdown}`);
    }
    if (metrics.topComplexFiles?.length) {
      lines.push('');
      lines.push('== Most complex files (from latest metrics snapshot) ==');
      metrics.topComplexFiles.slice(0, MAX_TOP_COMPLEX).forEach((f) => {
        lines.push(`- ${f.filePath} (complexity ${f.complexity})`);
      });
    }
  }

  const architecture = buildArchitecture(files, edges);
  const architectureSummary = renderArchitectureSummary(architecture);
  if (architectureSummary) {
    lines.push('');
    lines.push(architectureSummary);
  }

  const cycleGroups = groupByCycle(edges);
  lines.push('');
  lines.push(`== Circular dependencies (${cycleGroups.length} detected) ==`);
  if (cycleGroups.length === 0) {
    lines.push('None detected — the dependency graph is acyclic.');
  } else {
    cycleGroups.slice(0, MAX_CYCLES_SHOWN).forEach((group, i) => {
      const filesInCycle = Array.from(new Set(group.flatMap((e) => [e.sourcePath, e.targetPath])));
      lines.push(`- Cycle ${i + 1}: ${filesInCycle.join(' -> ')}`);
    });
    if (cycleGroups.length > MAX_CYCLES_SHOWN) {
      lines.push(`  ...and ${cycleGroups.length - MAX_CYCLES_SHOWN} more cycle(s).`);
    }
  }

  const entryPoints = files.filter((f) => f.isEntryPoint).map((f) => f.filePath);
  if (entryPoints.length) {
    lines.push('');
    lines.push('== Likely entry points ==');
    lines.push(entryPoints.slice(0, MAX_ENTRY_POINTS).join(', '));
  }

  lines.push('');
  lines.push(`== File listing (${files.length} files total) ==`);
  const sorted = [...files].sort((a, b) => (b.averageComplexity || 0) - (a.averageComplexity || 0));
  const shown = sorted.slice(0, MAX_LISTED_FILES);
  shown.forEach((f) => {
    const flags = [f.inCycle ? 'CYCLE' : null, f.isEntryPoint ? 'ENTRY' : null, f.parseError ? 'PARSE_ERROR' : null]
      .filter(Boolean)
      .join(',');
    lines.push(
      `- ${f.filePath} [${f.language}, ${f.linesOfCode} LOC, avg complexity ${(f.averageComplexity || 0).toFixed(1)}` +
        `${flags ? ', ' + flags : ''}]`
    );
  });
  if (files.length > shown.length) {
    lines.push(`...and ${files.length - shown.length} more file(s) omitted for brevity.`);
  }

  return lines.join('\n');
}

function groupByCycle(edges) {
  const groups = new Map();
  edges
    .filter((e) => e.isPartOfCycle)
    .forEach((e) => {
      const key = e.cycleId || `${e.sourcePath}|${e.targetPath}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
  return Array.from(groups.values());
}

module.exports = { getRepoContext, invalidate };
