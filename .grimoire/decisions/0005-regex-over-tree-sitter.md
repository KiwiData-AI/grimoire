---
status: accepted
date: 2026-04-03
decision-makers: [Fred]
---

# Use regex-based symbol extraction instead of Tree-sitter

## Context and Problem Statement
Grimoire needs to extract function signatures, class definitions, and exports from source files across Python, TypeScript, JavaScript, Go, and Rust. Two approaches: full AST parsing via Tree-sitter, or regex-based line-by-line extraction.

## Decision Drivers
- No native dependencies (tree-sitter requires compilation)
- Must work on all platforms without build tools
- 90% accuracy is acceptable — this feeds area docs, not a compiler
- Must be fast enough to run on large codebases

## Considered Options
1. Regex-based extraction (line-by-line pattern matching)
2. Tree-sitter AST parsing
3. Language server protocol queries

## Decision Outcome
Chosen option: "Regex-based extraction", because it avoids native dependencies entirely and covers the common cases. Line-by-line processing also bounds memory usage and eliminates ReDoS risk from large inputs.

### Consequences
- Good: Zero native dependencies — pure JavaScript
- Good: Fast, no compilation step needed
- Good: Line-by-line processing prevents memory issues on large files
- Bad: Cannot handle multi-line signatures, decorators, or complex generics
- Bad: May miss some symbols in unusual code patterns

### Confirmation
If symbol extraction captures enough API surface that area docs and plan tasks reference real functions and classes, the decision is validated. Can upgrade to tree-sitter later if regex proves insufficient.
