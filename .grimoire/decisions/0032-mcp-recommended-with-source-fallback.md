---
status: accepted
date: 2026-06-05
decision-makers: [Fred]
supersedes: 0030-mcp-required-conventions-replace-area-docs
---

# codebase-memory-mcp is the recommended structure source, with a source-reading fallback

## Context and Problem Statement

ADR 0030 made codebase-memory-mcp a **hard requirement** and decided to **replace area docs with per-area `conventions/` files**. Implementation of the artifact-model redesign (ADR 0031) reversed both halves of that decision:

- A hard MCP requirement would mean projects without the server installed cannot use grimoire at all. In practice the value of grimoire (drafting, planning, review, red-green apply) does not depend on the graph being present — only the *structure-lookup* steps do, and those degrade gracefully to reading source files.
- The separate `conventions/<area>.md` split never shipped. What ships is **intent-focused area docs** (Purpose, Boundaries, Conventions) — a single per-area doc that captures what the graph can't know, with structure (symbols, key files, reusable code) queried live from the graph rather than frozen into tables.

ADR 0030 therefore describes a model the codebase does not implement. It needs to be superseded so the decision register matches reality.

## Decision Drivers

- Don't lock out projects that can't or don't run the MCP server.
- Keep one consumption artifact per area (intent docs), not two (area doc + conventions file).
- Structure must stay live (graph), never frozen into a doc that drifts.
- The decision register must describe what the code actually does.

## Considered Options

1. **MCP recommended, with source-reading fallback; intent-focused area docs** — the graph is the preferred structure source and `init` offers to install it, but skills fall back to reading source files when the graph is genuinely unavailable. Area docs hold intent only (Purpose/Boundaries/Conventions); no separate conventions files.
2. **Keep ADR 0030 as written** — hard MCP requirement, conventions files replace area docs. (Not implemented; would lock out MCP-less projects.)
3. **Drop MCP entirely, go back to stored snapshots** — rejected by ADR 0031 (snapshots drift).

## Decision Outcome

Chosen option: **MCP recommended, with source-reading fallback; intent-focused area docs.**

- codebase-memory-mcp is the **preferred** source for structure (symbols, call graphs, reusable code, dead code). `grimoire init` offers to install it. It is **not** a hard prerequisite.
- Skills that need structure query the graph first; only when the graph is genuinely unavailable do they fall back to reading source files directly.
- `/grimoire:discover` generates **intent-focused area docs** in `.grimoire/docs/` — Purpose, Boundaries, Conventions (with exemplar file references) — plus the data schema and `index.yml` registry. Area docs deliberately do **not** contain Key Files or reusable-code inventories; that's structure, regenerated live by the graph.

ADR 0030 is superseded. Its driver (one consistent code-discovery path, no silent doc drift) is preserved — structure is always live — but the "hard requirement + conventions files" mechanism is replaced.

### Consequences

- Good: grimoire is usable without the MCP server, with reduced but functional structure lookup.
- Good: one area-doc artifact per area; intent and structure have clear, separate homes (doc vs graph).
- Good: the decision register now matches the shipped behavior.
- Bad: the fallback path means structure-lookup quality varies with whether the graph is present.
- Bad: two ADRs (0030, 0032) on the same topic in the history — readers must follow the supersede link.

### Quality Attributes

| Attribute      | Target | Measurement |
|----------------|--------|-------------|
| Data freshness | Always current when graph present | Graph queried live; area docs carry a `Last updated` and a staleness check vs git |
| Availability   | Usable without MCP | Skills degrade to source reading when the graph is unavailable |

### Cost of Ownership

- **Maintenance burden**: Skills carry a graph-or-source branch in their discovery steps. Area docs are small and human-maintained.
- **Ongoing benefits**: Wider adoption (no hard dependency); structure stays live; decision register is trustworthy.
- **Sunset criteria**: Revisit if the graph becomes ubiquitous enough to drop the fallback, or if codebase-memory-mcp is deprecated.

### Confirmation

After implementation: (1) running the workflow with no MCP server still drafts/plans/applies, using source reads for structure; (2) `/grimoire:discover` emits intent-focused area docs (no Key Files / reusable-code tables) and `index.yml`; (3) no `conventions/` directory is produced; (4) ADR 0030 shows `status: superseded`.
