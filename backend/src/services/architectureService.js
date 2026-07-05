/**
 * Classifies each analyzed file into a high-level architectural layer (e.g.
 * "Routes", "Controllers", "Services", "Models" for a backend; "Pages",
 * "Components", "Hooks", "API Client" for a frontend) and aggregates the
 * file-to-file dependency graph into a layer-to-layer graph.
 *
 * This is deliberately a different abstraction than the file graph
 * (repositoryController.getRepositoryGraph) or a folder graph (grouping by
 * literal top-level directory): layers are named by *responsibility*, are
 * few in number (usually 5-10 for an entire repo), and carry a "tier" — a
 * rough position in the request's/data's typical flow — so cross-layer
 * edges can be judged as flowing the expected direction or against it.
 *
 * Heuristic, not exhaustive: unmatched files land in "Other" rather than
 * being hidden, so file counts always reconcile with the file graph.
 */

// Layers are unified onto a single tier scale so structurally-analogous
// layers from different stacks compare sensibly against one another:
//   tier 0: the process/app entry point
//   tier 1: request/UI entry surface       (Routes / Pages / Views)
//   tier 2: orchestration                  (Controllers / Components)
//   tier 3: business logic / local state   (Services / Hooks / Store)
//   tier 4: data access boundary           (Models / API client)
//   tier 5: the data store itself          (Database / migrations)
//   tier null: cross-cutting, no expected position (Middleware, Config,
//              Utils, Types, Jobs, Tests) — never flagged as a violation.
const LAYER_DEFINITIONS = [
  { id: 'entry', label: 'Entry point', tier: 0, match: matchEntry },
  { id: 'tests', label: 'Tests', tier: null, match: matchTests },
  { id: 'types', label: 'Types', tier: null, match: (f, s) => hasSegment(s, 'types', 'interfaces') || /\.d\.ts$/i.test(f.filePath) },
  { id: 'config', label: 'Config', tier: null, match: (f, s) => hasSegment(s, 'config', 'configs') },
  { id: 'database', label: 'Database', tier: 5, match: (f, s) => hasSegment(s, 'migrations', 'migration', 'seeders', 'seeds') },
  { id: 'middleware', label: 'Middleware', tier: null, match: (f, s) => hasSegment(s, 'middleware', 'middlewares') },
  { id: 'jobs', label: 'Jobs / Workers', tier: null, match: (f, s) => hasSegment(s, 'jobs', 'workers', 'queues', 'queue', 'cron') },
  { id: 'routes', label: 'Routes', tier: 1, match: (f, s) => hasSegment(s, 'routes', 'router', 'routers') },
  { id: 'controllers', label: 'Controllers', tier: 2, match: (f, s) => hasSegment(s, 'controllers', 'controller') },
  { id: 'views', label: 'Views', tier: 2, match: (f, s) => hasSegment(s, 'views', 'templates') },
  { id: 'pages', label: 'Pages', tier: 1, match: (f, s) => hasSegment(s, 'pages') || hasSegment(s, 'app') },
  { id: 'components', label: 'Components', tier: 2, match: (f, s) => hasSegment(s, 'components', 'component') },
  { id: 'store', label: 'Store / State', tier: 3, match: (f, s) => hasSegment(s, 'store', 'stores', 'redux', 'context', 'contexts', 'state') },
  { id: 'hooks', label: 'Hooks', tier: 3, match: (f, s) => hasSegment(s, 'hooks') },
  { id: 'services', label: 'Services', tier: 3, match: (f, s) => hasSegment(s, 'services', 'service') },
  { id: 'api-client', label: 'API Client', tier: 4, match: (f, s) => hasSegment(s, 'api') && !hasSegment(s, 'routes') },
  { id: 'models', label: 'Models', tier: 4, match: (f, s) => hasSegment(s, 'models', 'model', 'schemas', 'schema', 'entities', 'repositories', 'repository', 'dao') },
  { id: 'utils', label: 'Utils', tier: null, match: (f, s) => hasSegment(s, 'utils', 'util', 'helpers', 'helper', 'lib', 'libs') },
];

const OTHER_LAYER = { id: 'other', label: 'Other', tier: null };

function segments(filePath) {
  return filePath.toLowerCase().split('/').filter(Boolean);
}

function hasSegment(segs, ...keywords) {
  return segs.some((seg) => keywords.includes(seg));
}

function matchTests(file, segs) {
  if (hasSegment(segs, 'test', 'tests', '__tests__', '__mocks__', 'spec', 'specs')) return true;
  if (/\.(test|spec)\.[jt]sx?$/i.test(file.fileName)) return true;
  if (/^test_.*\.py$/i.test(file.fileName) || /_test\.py$/i.test(file.fileName)) return true;
  return false;
}

// Only counts as the app's entry point at (or near) the repo root — a
// nested `routes/index.js` barrel file is far more useful classified as
// Routes than lumped in with the process entry point.
function matchEntry(file, segs) {
  if (segs.length > 1) return false;
  return /^(index|main|app|server|manage)\.(js|jsx|ts|tsx|mjs|cjs|py)$/i.test(file.fileName);
}

/** Returns the first matching layer definition for a file, or OTHER_LAYER. */
function classifyFile(file) {
  const segs = segments(file.filePath);
  for (const layer of LAYER_DEFINITIONS) {
    if (layer.match(file, segs)) return layer;
  }
  return OTHER_LAYER;
}

function directionFor(sourceTier, targetTier) {
  if (sourceTier === null || targetTier === null || sourceTier === undefined || targetTier === undefined) {
    return 'lateral';
  }
  if (targetTier > sourceTier) return 'forward';
  if (targetTier < sourceTier) return 'backward';
  return 'lateral';
}

const MAX_SAMPLE_IMPORTS = 5;

/**
 * @param {Array} fileNodes  FileNode docs (needs filePath, fileName, language,
 *   linesOfCode, fileComplexity, averageComplexity, inCycle)
 * @param {Array} dependencyEdges  DependencyEdge docs (needs sourcePath, targetPath)
 */
function buildArchitecture(fileNodes, dependencyEdges) {
  const layerByPath = new Map();
  const layerStats = new Map(); // layerId -> accumulator

  fileNodes.forEach((file) => {
    const layer = classifyFile(file);
    layerByPath.set(file.filePath, layer);

    if (!layerStats.has(layer.id)) {
      layerStats.set(layer.id, {
        id: layer.id,
        label: layer.label,
        tier: layer.tier,
        fileCount: 0,
        totalLinesOfCode: 0,
        complexitySum: 0,
        cycleFileCount: 0,
        files: [],
      });
    }
    const stat = layerStats.get(layer.id);
    stat.fileCount += 1;
    stat.totalLinesOfCode += file.linesOfCode || 0;
    stat.complexitySum += file.averageComplexity || 0;
    if (file.inCycle) stat.cycleFileCount += 1;
    stat.files.push(file.filePath);
  });

  const layers = [...layerStats.values()]
    .map((s) => ({
      id: s.id,
      label: s.label,
      tier: s.tier,
      fileCount: s.fileCount,
      totalLinesOfCode: s.totalLinesOfCode,
      averageComplexity: s.fileCount ? Number((s.complexitySum / s.fileCount).toFixed(2)) : 0,
      cycleFileCount: s.cycleFileCount,
      files: s.files.sort(),
    }))
    .sort((a, b) => {
      const at = a.tier ?? Number.MAX_SAFE_INTEGER;
      const bt = b.tier ?? Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return b.fileCount - a.fileCount;
    });

  const edgeAgg = new Map(); // "sourceLayer|targetLayer" -> accumulator

  dependencyEdges.forEach((edge) => {
    const sourceLayer = layerByPath.get(edge.sourcePath);
    const targetLayer = layerByPath.get(edge.targetPath);
    if (!sourceLayer || !targetLayer || sourceLayer.id === targetLayer.id) return; // intra-layer, not shown as an edge

    const key = `${sourceLayer.id}|${targetLayer.id}`;
    if (!edgeAgg.has(key)) {
      edgeAgg.set(key, {
        source: sourceLayer.id,
        target: targetLayer.id,
        direction: directionFor(sourceLayer.tier, targetLayer.tier),
        weight: 0,
        sampleImports: [],
      });
    }
    const agg = edgeAgg.get(key);
    agg.weight += 1;
    if (agg.sampleImports.length < MAX_SAMPLE_IMPORTS) {
      agg.sampleImports.push({ from: edge.sourcePath, to: edge.targetPath });
    }
  });

  const edges = [...edgeAgg.values()].sort((a, b) => b.weight - a.weight);
  const violations = edges.filter((e) => e.direction === 'backward');

  return {
    layers,
    edges,
    violationCount: violations.length,
    unclassifiedCount: layerStats.get('other')?.fileCount || 0,
  };
}

/** Compact plain-text rendering used to ground AI prompts (see aiContextService). */
function renderArchitectureSummary(architecture) {
  if (!architecture.layers.length) return null;
  const lines = ['== Architecture (layers inferred from file paths) =='];
  architecture.layers.forEach((l) => {
    lines.push(`- ${l.label}: ${l.fileCount} file(s), avg complexity ${l.averageComplexity}`);
  });
  if (architecture.edges.length) {
    lines.push('Layer dependencies:');
    architecture.edges.forEach((e) => {
      const sourceLabel = architecture.layers.find((l) => l.id === e.source)?.label || e.source;
      const targetLabel = architecture.layers.find((l) => l.id === e.target)?.label || e.target;
      const flag = e.direction === 'backward' ? ' [violates expected layering]' : '';
      lines.push(`  ${sourceLabel} -> ${targetLabel} (${e.weight} import${e.weight === 1 ? '' : 's'})${flag}`);
    });
  }
  if (architecture.violationCount > 0) {
    lines.push(
      `${architecture.violationCount} layer dependency(ies) run against the expected top-down flow — a common architectural smell.`
    );
  }
  return lines.join('\n');
}

module.exports = { buildArchitecture, classifyFile, renderArchitectureSummary, LAYER_DEFINITIONS };
