#!/usr/bin/env python3
"""
Reads Python source from stdin, parses it with the stdlib `ast` module, and
prints a JSON object to stdout describing imports, exports (top-level
functions/classes), and per-function cyclomatic complexity.

Usage: python3 parse_python_ast.py < file.py
Exit code 0 with JSON on success. Exit code 1 with {"error": "..."} on
SyntaxError/parse failure so the calling Node process can record parseError.
"""
import ast
import json
import sys


DECISION_NODES = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.Try,
    ast.ExceptHandler,
    ast.With,
    ast.AsyncWith,
)


def function_complexity(node):
    """McCabe-style complexity: 1 + decision points within this function only
    (nested function/class defs are not descended into)."""
    complexity = 1

    class Visitor(ast.NodeVisitor):
        def generic_visit(self, n):
            nonlocal complexity
            if isinstance(n, (ast.If, ast.For, ast.AsyncFor, ast.While)):
                complexity += 1
            elif isinstance(n, ast.ExceptHandler):
                complexity += 1
            elif isinstance(n, ast.BoolOp):
                # each extra operand after the first is a branch (and/or chains)
                complexity += max(len(n.values) - 1, 0)
            elif isinstance(n, ast.IfExp):
                complexity += 1  # ternary
            elif isinstance(n, (ast.comprehension,)):
                complexity += 1 + len(n.ifs)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)) and n is not node:
                return  # don't descend into nested defs
            super().generic_visit(n)

    Visitor().generic_visit(node)
    return complexity


def extract_functions(tree):
    functions = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append({
                "name": node.name,
                "startLine": node.lineno,
                "endLine": getattr(node, "end_lineno", node.lineno),
                "cyclomaticComplexity": function_complexity(node),
                "paramCount": len(node.args.args),
                "isAsync": isinstance(node, ast.AsyncFunctionDef),
                "isExported": not node.name.startswith("_"),
            })
    return functions


def extract_imports(tree):
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({
                    "source": alias.name,
                    "isExternal": True,  # resolved against discovered files in Node layer
                    "importedNames": [],
                    "isDefaultImport": False,
                    "isNamespaceImport": True,
                })
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ("." * node.level)
            names = [alias.name for alias in node.names]
            imports.append({
                "source": ("." * node.level) + (module if node.module else ""),
                "isExternal": node.level == 0,
                "importedNames": names,
                "isDefaultImport": False,
                "isNamespaceImport": False,
            })
    return imports


def extract_exports(tree):
    exports = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
            exports.append({"name": node.name, "type": "function"})
        elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
            exports.append({"name": node.name, "type": "class"})
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and not target.id.startswith("_"):
                    exports.append({"name": target.id, "type": "variable"})
    return exports


def main():
    source = sys.stdin.read()
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        print(json.dumps({"error": f"SyntaxError: {e.msg} (line {e.lineno})"}))
        sys.exit(1)

    result = {
        "imports": extract_imports(tree),
        "exports": extract_exports(tree),
        "functions": extract_functions(tree),
        "linesOfCode": len(source.splitlines()),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
