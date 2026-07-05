const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { calculateFunctionComplexity } = require('./complexityCalculator');

const BABEL_PLUGINS = [
  'jsx',
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'objectRestSpread',
  'topLevelAwait',
];

function pickParserPlugins() {
  // JS/JSX files never contain TS-only syntax so it's safe to always include
  // the typescript plugin — babel only activates TS-specific parsing when it
  // actually encounters TS syntax.
  return BABEL_PLUGINS;
}

/**
 * Parses a single JS/TS/JSX/TSX file's source into { imports, exports, functions, linesOfCode }.
 * Throws on unrecoverable syntax errors — caller should catch and record parseError.
 */
function parseJavaScriptFile(source, filePath, extension) {
  const ast = parser.parse(source, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    errorRecovery: true,
    plugins: pickParserPlugins(extension),
  });

  const imports = [];
  const exports = [];
  const functions = [];

  traverse(ast, {
    ImportDeclaration(path) {
      const src = path.node.source.value;
      const importedNames = [];
      let isDefaultImport = false;
      let isNamespaceImport = false;

      for (const spec of path.node.specifiers) {
        if (t.isImportDefaultSpecifier(spec)) {
          isDefaultImport = true;
          importedNames.push('default');
        } else if (t.isImportNamespaceSpecifier(spec)) {
          isNamespaceImport = true;
          importedNames.push('*');
        } else if (t.isImportSpecifier(spec)) {
          importedNames.push(t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value);
        }
      }

      imports.push({
        source: src,
        isExternal: !src.startsWith('.') && !src.startsWith('/'),
        importedNames,
        isDefaultImport,
        isNamespaceImport,
      });
    },

    // CommonJS: const x = require('y')
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length === 1 &&
        t.isStringLiteral(path.node.arguments[0])
      ) {
        const src = path.node.arguments[0].value;
        imports.push({
          source: src,
          isExternal: !src.startsWith('.') && !src.startsWith('/'),
          importedNames: [],
          isDefaultImport: false,
          isNamespaceImport: false,
        });
      }
    },

    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        const decl = path.node.declaration;
        if (t.isFunctionDeclaration(decl) && decl.id) {
          exports.push({ name: decl.id.name, type: 'function' });
        } else if (t.isClassDeclaration(decl) && decl.id) {
          exports.push({ name: decl.id.name, type: 'class' });
        } else if (t.isVariableDeclaration(decl)) {
          for (const d of decl.declarations) {
            if (t.isIdentifier(d.id)) exports.push({ name: d.id.name, type: 'variable' });
          }
        }
      }
      for (const spec of path.node.specifiers || []) {
        if (t.isExportSpecifier(spec)) {
          const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
          exports.push({ name, type: 'other' });
        }
      }
    },

    ExportDefaultDeclaration() {
      exports.push({ name: 'default', type: 'default' });
    },

    ExportAllDeclaration() {
      exports.push({ name: '*', type: 'other' });
    },

    // CommonJS: module.exports = ... / exports.foo = ...
    AssignmentExpression(path) {
      const { left } = path.node;
      if (
        t.isMemberExpression(left) &&
        t.isIdentifier(left.object, { name: 'module' }) &&
        t.isIdentifier(left.property, { name: 'exports' })
      ) {
        exports.push({ name: 'default', type: 'default' });
      } else if (t.isMemberExpression(left) && t.isIdentifier(left.object, { name: 'exports' })) {
        const name = t.isIdentifier(left.property) ? left.property.name : 'unknown';
        exports.push({ name, type: 'other' });
      }
    },

    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ObjectMethod'(path) {
      const node = path.node;
      let name = 'anonymous';
      let isExported = false;

      if (t.isFunctionDeclaration(node) && node.id) {
        name = node.id.name;
      } else if (t.isClassMethod(node) || t.isObjectMethod(node)) {
        name = t.isIdentifier(node.key) ? node.key.name : 'method';
      } else {
        // try to infer name from variable declarator: const foo = () => {}
        const parent = path.parentPath && path.parentPath.node;
        if (parent && t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
          name = parent.id.name;
        } else if (parent && t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) {
          name = parent.left.name;
        }
      }

      // Rough exported check: declared directly under an export statement,
      // or its name appears in the exports list collected above.
      if (path.parentPath && t.isExportNamedDeclaration(path.parentPath.node)) isExported = true;
      if (path.parentPath && t.isExportDefaultDeclaration(path.parentPath.node)) isExported = true;
      if (exports.some((e) => e.name === name)) isExported = true;

      functions.push({
        name,
        startLine: node.loc ? node.loc.start.line : undefined,
        endLine: node.loc ? node.loc.end.line : undefined,
        cyclomaticComplexity: calculateFunctionComplexity(path),
        paramCount: node.params ? node.params.length : 0,
        isAsync: !!node.async,
        isExported,
      });
    },
  });

  const linesOfCode = source.split('\n').length;

  return { imports, exports, functions, linesOfCode };
}

module.exports = { parseJavaScriptFile };
