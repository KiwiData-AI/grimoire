---
status: accepted
date: 2026-05-22
decision-makers: [Fred]
supersedes: 0029-delegate-symbol-intelligence-to-codebase-memory-mcp
---

# Make codebase-memory-mcp a hard requirement and replace area docs with conventions files

## Context and Problem Statement

ADR 0029 delegated symbol intelligence to `codebase-memory-mcp` but kept a fallback path (file reads via Grep/Glob) for when the MCP server isn't installed. Skills that need code discovery branch on MCP availability: they sometimes query the graph, sometimes read area docs, sometimes read source files directly. This inconsistency produces worse agent output than either path alone — the agent can't build a reliable mental model of which information source to trust. Meanwhile, the per-area markdown files in `.grimoire/docs/` go stale whenever code changes and require periodic `grimoire map --refresh` to stay accurate.

## Decision Drivers

- Consistent agent behavior requires one code-discovery path, not two or three
- MCP is always accurate (live AST); area docs require manual refresh and drift silently
- Maintaining fallback paths adds complexity to every skill that touches code discovery
- `grimoire map`'s primary job (generating snapshot.json as input to area doc generation) becomes unnecessary when area docs are removed
- Project-level conventions (file placement, naming, patterns) are genuinely not inferable from AST alone and still need a human-maintained artifact — but that's a much smaller surface than full area docs

## Considered Options

1. **MCP hard required + per-area conventions files** — remove fallback paths; replace area docs with lightweight conventions files covering only what MCP can't answer (file placement, naming, patterns); `grimoire map` morphs into drift detection between conventions and current code
2. **Keep area docs, auto-refresh via MCP** — precommit-review triggers `grimoire-discover` targeted refresh when docs are stale; area docs remain the consumption artifact but MCP keeps them current
3. **Keep both paths (status quo)** — skills branch on MCP availability; area docs persist alongside MCP queries

## Decision Outcome

Chosen option: **MCP hard required + per-area conventions files**.

`codebase-memory-mcp` is now a prerequisite for grimoire. Skills that need code discovery use MCP tools (`search_graph`, `get_architecture`, `get_code_snippet`) exclusively — no fallback to area docs or direct file reads. Per-area docs in `.grimoire/docs/<area>.md` are removed and archived on first `grimoire-discover` run. They are replaced by `.grimoire/docs/conventions/<area>.md` files containing only what MCP cannot answer: file placement rules, naming conventions, and pattern guidance. `grimoire map` morphs from snapshot generation into a drift-detection command that compares conventions files against the live codebase via MCP and reports mismatches.

Option 2 was rejected because it still produces stale docs between refreshes and still requires agents to decide whether to trust the doc or query the graph. Option 3 was rejected because it is the source of the problem.

### Consequences

- Good: One code-discovery path — skills are simpler and produce more consistent output.
- Good: No stale area docs; MCP is always current.
- Good: Conventions files are small and stable (placement/naming/patterns change infrequently); `grimoire map` drift detection makes staleness visible.
- Good: `grimoire map` becomes genuinely useful as a maintenance tool rather than a one-time setup step.
- Bad: MCP is now a hard install requirement; projects without it cannot use grimoire.
- Bad: Existing projects with area docs need a one-time migration (archived by discover).
- Bad: Conventions files can still drift — they require human review when `grimoire map` reports drift.

### Cost of Ownership

- **Maintenance burden**: Zero in-house code-discovery logic. Conventions files are small and human-maintained; `grimoire map` surfaces when they need updating.
- **Ongoing benefits**: Skills always read fresh data from MCP; no periodic refresh cycle.
- **Sunset criteria**: Revisit if `codebase-memory-mcp` is deprecated or if MCP protocol support drops from major agents.

### Confirmation

After implementation: run discover on a real project and verify (1) no area docs remain in `.grimoire/docs/`, (2) plan generates tasks with correct file paths sourced from MCP queries, (3) `grimoire map` correctly flags a deliberately stale conventions rule.

### Quality Attributes

| Attribute      | Target | Measurement |
|----------------|--------|-------------|
| Data freshness | Always current | MCP queries live AST on every invocation |
| Consistency    | One discovery path | No branch on MCP availability in any skill |
