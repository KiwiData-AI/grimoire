---
status: accepted
date: 2026-04-03
decision-makers: [Fred]
---

# Symbol extraction limited to signatures (no call graphs)

## Context and Problem Statement
Grimoire's `map --symbols` extracts code symbols for area docs and the plan skill. ADR-0005 decided on regex over tree-sitter for extraction. This decision addresses *what* to extract — should grimoire build call graphs and data flow analysis, or stop at function signatures?

## Decision Drivers
- Area docs need to know what functions/classes exist and their signatures
- Call graphs and data flow require full AST parsing or runtime tracing
- Grimoire targets zero native dependencies (ADR-0005)
- Richer analysis tools already exist (codebase-memory-mcp, LSP servers)

## Considered Options
1. Signatures only — function names, parameters, return types, class definitions, exports
2. Signatures + call graphs — also extract which functions call which
3. Full static analysis — signatures, call graphs, data flow, dependency graphs
4. Delegate entirely — don't extract symbols, rely on external tools

## Decision Outcome
Chosen option: "Signatures only", because it provides the 90% of value needed for area docs and planning (knowing what exists and where) without the complexity of call graph extraction. Projects needing call graphs, data flow tracing, and dependency analysis are pointed to [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp), which provides graph-based code intelligence via MCP.

### Consequences
- Good: Fast extraction with no native dependencies
- Good: Sufficient for area docs, plan skill, and reusable code inventory
- Good: Clear scope boundary — grimoire does structure, external tools do analysis
- Good: codebase-memory-mcp integration documented in README for teams that need more
- Bad: Plan skill can't automatically detect affected callers when modifying a function
- Bad: Refactor skill's impact analysis is limited to file-level, not function-level

### Confirmation
If area docs generated from signature-only extraction contain enough detail for the plan skill to reference real function names and file paths in tasks, the decision is validated.
