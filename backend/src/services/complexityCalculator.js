const t = require('@babel/types');

/**
 * Computes McCabe cyclomatic complexity for a given function's AST path.
 * Base complexity is 1; +1 for each decision point:
 * if/else-if, for, for-in, for-of, while, do-while, case (in switch),
 * catch, logical && / || / ??, ternary (?:), optional chaining short-circuit.
 *
 * Nested functions are NOT counted into the parent's complexity — they get
 * their own score (handled separately by the caller, which visits every
 * function node independently).
 */
function calculateFunctionComplexity(functionPath) {
  let complexity = 1;

  functionPath.traverse({
    IfStatement() {
      complexity += 1;
    },
    ForStatement() {
      complexity += 1;
    },
    ForInStatement() {
      complexity += 1;
    },
    ForOfStatement() {
      complexity += 1;
    },
    WhileStatement() {
      complexity += 1;
    },
    DoWhileStatement() {
      complexity += 1;
    },
    SwitchCase(path) {
      // Each non-default case is a branch
      if (path.node.test !== null) complexity += 1;
    },
    CatchClause() {
      complexity += 1;
    },
    ConditionalExpression() {
      complexity += 1; // ternary
    },
    LogicalExpression(path) {
      if (path.node.operator === '&&' || path.node.operator === '||' || path.node.operator === '??') {
        complexity += 1;
      }
    },
    // Don't descend into nested function bodies when counting the parent's score
    FunctionDeclaration(path) {
      path.skip();
    },
    FunctionExpression(path) {
      path.skip();
    },
    ArrowFunctionExpression(path) {
      path.skip();
    },
    ClassMethod(path) {
      path.skip();
    },
    ObjectMethod(path) {
      path.skip();
    },
  });

  return complexity;
}

function isFunctionNode(node) {
  return (
    t.isFunctionDeclaration(node) ||
    t.isFunctionExpression(node) ||
    t.isArrowFunctionExpression(node) ||
    t.isClassMethod(node) ||
    t.isObjectMethod(node)
  );
}

module.exports = { calculateFunctionComplexity, isFunctionNode };
