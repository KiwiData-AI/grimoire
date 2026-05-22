---
change-id: replace-area-docs-with-mcp-discovery
status: implementing
branch: feat/replace-area-docs-with-mcp-discovery
complexity: 4
date: 2026-05-21
---

# Replace area docs with MCP + per-area conventions files

## Why

Skills that need code discovery currently branch on MCP availability — sometimes querying the graph, sometimes reading area docs. This inconsistency produces worse agent output than either path alone. Area docs also go stale silently. Making MCP the single source of truth eliminates the branch and the staleness problem. Conventions files replace area docs for the small set of semantic knowledge MCP cannot provide.

## What changes

**Modified features:**
- `features/onboarding/run-discover.feature` — removes area-doc and snapshot scenarios; adds conventions-file generation, MCP-required guard, and legacy doc archival
- `features/onboarding/run-audit.feature` — adds conventions drift detection scenarios and extends scope options
- `features/cli/map.feature` — replaces snapshot/refresh scenarios with drift detection against conventions files; keeps `--duplicates`
- `features/cli/init.feature` — simplifies onboarding next-steps: removes `grimoire map` as prerequisite step; existing-project flow is now init → discover → audit (3 steps not 4)

**New decisions:**
- `decisions/0030-mcp-required-conventions-replace-area-docs.md` — supersedes ADR 0029's fallback approach

**Skills to update (implementation stage):**
- `grimoire-discover` — produces `.grimoire/docs/conventions/<area>.md` instead of area docs; archives existing area docs; requires MCP; removes snapshot dependency (step 1 of current workflow eliminated)
- `grimoire-audit` — adds conventions drift detection (via MCP comparison); new scope option "conventions"; batches drift findings alongside dead features and stale decisions
- `grimoire-plan` — reads conventions files (not area docs) for placement/naming; queries MCP directly for symbol/utility lookup; staleness gate removed (MCP is always current)
- `grimoire-apply` — context blocks reference conventions files, not area docs
- `grimoire-precommit-review` — removes auto-refresh-of-area-docs logic (added this session, now obsolete); retains coverage gap scan; reads conventions files for project context
- `grimoire map` CLI command — morphs from snapshot generation to drift detection; removes `--refresh`, `--symbols`, `--compress` flags; keeps `--duplicates`
- `AGENTS.md` / `README` — update onboarding decision tree to remove `grimoire map` as a prerequisite step

**Removals:**
- `.grimoire/docs/index.yml` — no longer generated or consumed
- `.grimoire/docs/.snapshot.json` — no longer generated; map no longer produces it
- `grimoire map --refresh`, `--symbols`, `--compress` flags — removed

## Non-goals

- Not changing schema.yml, context.yml, or components.md generation
- Not changing grimoire-audit's core dead-feature detection flow
- Not removing `--duplicates` from grimoire map

## Assumptions

- `codebase-memory-mcp` is installable by all grimoire users (it is an npm-distributable MCP server)
- Conventions files (placement/naming/patterns) are stable enough that human refresh on `grimoire map` drift signal is acceptable — they don't need automated refresh
- Existing area docs can be safely archived without loss; their symbol/utility content is superseded by MCP queries

## Pre-Mortem

- **MCP not available in some agents**: If `codebase-memory-mcp` stops being supported in a major agent, grimoire loses code discovery entirely. Mitigation: monitor MCP ecosystem; the ADR has explicit sunset criteria.
- **Conventions files ignored**: Developers stop updating conventions when `grimoire map` flags drift, defeating the purpose. Mitigation: `grimoire-audit` drift reporting keeps the signal visible in the review loop.
- **Migration breaks existing workflows**: Projects heavily using area docs lose reusable-code tables they depended on. Mitigation: archival (not deletion) and clear migration guide in the discover skill.

## Prior Art

- ADR 0029 established MCP delegation with fallback — this change removes the fallback
- ADR 0015 (superseded by 0029) documented the in-house symbol extractor — fully removed
- The dual-path pattern (MCP + fallback) appears in other MCP-backed tools; most move to hard-require once MCP stability is established (e.g., Cursor's Composer requiring indexing)
