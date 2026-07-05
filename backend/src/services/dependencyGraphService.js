const path = require('path');

const JS_RESOLVE_EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const JS_INDEX_FILES = ['index.js', 'index.jsx', 'index.ts', 'index.tsx'];
const PY_RESOLVE_EXTENSIONS = ['', '.py'];

/**
 * Attempts to resolve a relative import specifier to one of the discovered
 * file paths (all POSIX-style, relative to repo root). Returns the matching
 * filePath or null if it can't be resolved locally (external package, or
 * points outside the analyzed file set).
 */
function resolveImportPath(fromFilePath, importSource, filePathSet, language) {
  if (language === 'python') {
    return resolvePythonImport(fromFilePath, importSource, filePathSet);
  }
  return resolveJsImport(fromFilePath, importSource, filePathSet);
}

function resolveJsImport(fromFilePath, importSource, filePathSet) {
  if (!importSource.startsWith('.')) return null; // external package or alias we can't resolve safely

  const fromDir = path.posix.dirname(fromFilePath);
  const rawTarget = path.posix.normalize(path.posix.join(fromDir, importSource));

  for (const ext of JS_RESOLVE_EXTENSIONS) {
    const candidate = rawTarget + ext;
    if (filePathSet.has(candidate)) return candidate;
  }
  for (const indexFile of JS_INDEX_FILES) {
    const candidate = path.posix.join(rawTarget, indexFile);
    if (filePathSet.has(candidate)) return candidate;
  }
  return null;
}

function resolvePythonImport(fromFilePath, importSource, filePathSet) {
  // Relative import like ".utils" or "..pkg.mod"
  if (importSource.startsWith('.')) {
    const dots = importSource.match(/^\.+/)[0].length;
    const modulePart = importSource.slice(dots).replace(/\./g, '/');
    let baseDir = path.posix.dirname(fromFilePath);
    for (let i = 1; i < dots; i += 1) baseDir = path.posix.dirname(baseDir);

    const rawTarget = modulePart ? path.posix.normalize(path.posix.join(baseDir, modulePart)) : baseDir;
    for (const ext of PY_RESOLVE_EXTENSIONS) {
      const candidate = rawTarget + ext;
      if (filePathSet.has(candidate)) return candidate;
    }
    const candidateInit = path.posix.join(rawTarget, '__init__.py');
    if (filePathSet.has(candidateInit)) return candidateInit;
    return null;
  }

  // Absolute-style import ("myapp.utils.helper") — only resolvable if it
  // maps onto a file that exists within the analyzed repo (best-effort).
  const asPath = importSource.replace(/\./g, '/');
  for (const ext of PY_RESOLVE_EXTENSIONS) {
    const candidate = asPath + ext;
    if (filePathSet.has(candidate)) return candidate;
  }
  const candidateInit = path.posix.join(asPath, '__init__.py');
  if (filePathSet.has(candidateInit)) return candidateInit;
  return null;
}

/**
 * Given the list of persisted FileNode docs (each with .imports and .filePath),
 * builds an edge list: { sourcePath, targetPath, importedNames }.
 * Also mutates each fileNode's import entries with resolvedPath/isExternal (final values).
 */
function buildDependencyEdges(fileNodes) {
  const filePathSet = new Set(fileNodes.map((f) => f.filePath));
  const edges = [];
  const edgeKeys = new Set(); // dedupe multiple imports between the same two files

  for (const file of fileNodes) {
    for (const imp of file.imports) {
      if (imp.isExternal) continue;

      const resolved = resolveImportPath(file.filePath, imp.source, filePathSet, file.language);
      imp.resolvedPath = resolved || undefined;
      if (!resolved) {
        // couldn't resolve locally — treat as external/unresolvable so it doesn't break the graph
        imp.isExternal = true;
        continue;
      }
      if (resolved === file.filePath) continue; // ignore self-imports

      const key = `${file.filePath}=>${resolved}`;
      if (edgeKeys.has(key)) {
        // merge imported names into the existing edge
        const existing = edges.find((e) => e.sourcePath === file.filePath && e.targetPath === resolved);
        if (existing) {
          existing.importedNames = Array.from(new Set([...existing.importedNames, ...imp.importedNames]));
        }
        continue;
      }
      edgeKeys.add(key);
      edges.push({
        sourcePath: file.filePath,
        targetPath: resolved,
        importedNames: [...imp.importedNames],
      });
    }
  }

  return edges;
}

module.exports = { buildDependencyEdges, resolveImportPath };
