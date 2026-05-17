---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
supersedes: 0015-symbol-extraction-depth
---

# Delegate symbol and call-graph intelligence to codebase-memory-mcp

## Context and Problem Statement
ADR 0015 chose to extract function signatures via regex inside grimoire itself (`src/core/symbols.ts`, `grimoire map --symbols`). Since that decision, `codebase-memory-mcp` has matured into a graph-based code-intelligence MCP server that provides AST-accurate symbol enumeration, call-graph traversal, cross-service tracing, and dead-code detection across 66 languages. Maintaining grimoire's own regex-based extractor became redundant work that produced strictly less accurate output than the MCP server we now require for the same skills.

## Decision Drivers
- AST-accurate symbol data beats regex extraction on every quality dimension
- 66-language coverage in `codebase-memory-mcp` exceeds anything we'd plausibly maintain in-house
- Skills (`discover`, `audit`, `refactor`, `plan`) already query the graph when available; the in-house extractor was dead code in practice
- Removing a homegrown module reduces grimoire's surface area and dep footprint
- A symbol/call-graph feature is exactly the kind of thing the MCP ecosystem exists for

## Considered Options
1. **Delegate fully to `codebase-memory-mcp`** — remove the in-house extractor and the related feature/CLI flag; skills prefer the MCP server and fall back to file reads only when it's not available
2. **Keep both** — maintain `symbols.ts` as a fallback when the MCP server isn't installed
3. **Rewrite `symbols.ts` to use tree-sitter** — match the MCP's accuracy in-house
4. **Defer** — keep `symbols.ts` as-is, accept the duplication

## Decision Outcome
Chosen option: **Delegate fully to `codebase-memory-mcp`**. The in-house extractor and CLI surface are removed. Skills that need symbols/call-graphs use the MCP server's tools (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`). When the MCP server is not registered, skills fall back to file reads with `Grep`/`Glob` — slower and less precise, but functional.

ADR 0015 is marked `superseded` and points at this ADR.

### Consequences
- Good: Symbol intelligence becomes strictly more accurate.
- Good: Grimoire ships less code (~one file plus its tests removed).
- Good: We stop maintaining language-specific regex patterns.
- Good: Skill consumers benefit from MCP server updates without grimoire releases.
- Bad: Symbol intelligence is no longer available when the MCP server isn't installed; fallback paths are slower.
- Bad: Skills must handle the "MCP not available" branch in their workflow text.
- Bad: This is a removal — anyone who depended on `grimoire map --symbols` in scripts will see a missing flag (mitigation: it was already removed before this ADR was written; this just documents the removal formally).

### Cost of Ownership
- **Maintenance burden**: Zero in-house extractor maintenance. We do depend on `codebase-memory-mcp` for the optimal experience.
- **Ongoing benefits**: Skills automatically improve as the MCP server improves; we focus on workflow rather than parsing.
- **Sunset criteria**: Revisit if `codebase-memory-mcp` is abandoned, if a comparable in-process alternative emerges, or if MCP itself stops being the right contract for code-intelligence delivery.

### Confirmation
If the `discover`, `audit`, `refactor`, and `plan` skills produce equal-or-better outputs without `symbols.ts`, and no user reports asking for the removed CLI flag arrive in a release cycle, the decision is validated.
