const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');

const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py'];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/venv/**',
  '**/.venv/**',
  '**/env/**',
  '**/__pycache__/**',
  '**/*.min.js',
  '**/vendor/**',
  '**/.turbo/**',
  '**/site-packages/**',
];

const MAX_FILE_SIZE_BYTES = 1.5 * 1024 * 1024; // skip abnormally huge generated files
const MAX_FILES = 3000; // hard cap so a monorepo doesn't blow up the pipeline

const EXTENSION_LANGUAGE_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
};

/**
 * Walks the cloned repo and returns a list of { filePath, absolutePath, fileName,
 * extension, language, sizeBytes } for every analyzable file, capped at MAX_FILES.
 * filePath is relative to repoRoot (POSIX separators) — this is what's stored on FileNode.
 */
async function discoverFiles(repoRoot) {
  const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(',')}}`;
  const matches = await glob(pattern, {
    cwd: repoRoot,
    ignore: IGNORE_PATTERNS,
    nodir: true,
    dot: false,
  });

  const files = [];
  for (const relPath of matches) {
    if (files.length >= MAX_FILES) break;

    const absolutePath = path.join(repoRoot, relPath);
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      continue; // broken symlink etc.
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) continue;

    const extension = path.extname(relPath).toLowerCase();
    if (!EXTENSION_LANGUAGE_MAP[extension]) continue;

    files.push({
      filePath: relPath.split(path.sep).join('/'),
      absolutePath,
      fileName: path.basename(relPath),
      extension,
      language: EXTENSION_LANGUAGE_MAP[extension],
      sizeBytes: stat.size,
    });
  }

  return files;
}

module.exports = { discoverFiles, SUPPORTED_EXTENSIONS, MAX_FILES };
