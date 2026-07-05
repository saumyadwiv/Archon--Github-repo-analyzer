const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'parse_python_ast.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const TIMEOUT_MS = 15000;

/**
 * Parses a single Python file's source via the stdlib `ast` module (invoked
 * as a subprocess). Returns { imports, exports, functions, linesOfCode }.
 * Throws if python3 is unavailable or the source has a SyntaxError.
 */
function parsePythonFile(source) {
  const result = spawnSync(PYTHON_BIN, [SCRIPT_PATH], {
    input: source,
    encoding: 'utf-8',
    timeout: TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('python3 not found on PATH — required to parse .py files');
    }
    throw result.error;
  }

  if (!result.stdout) {
    throw new Error(`Python parser produced no output (stderr: ${result.stderr || 'none'})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Python parser returned invalid JSON: ${result.stdout.slice(0, 200)}`);
  }

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return parsed;
}

module.exports = { parsePythonFile };
