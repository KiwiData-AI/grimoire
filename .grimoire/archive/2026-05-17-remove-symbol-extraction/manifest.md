---
status: archived
complexity: small
branch:
design_ref:
kind: removal
archived_on: 2026-05-17
---

# Change: Remove symbol-extraction feature and supersede ADR 0015

## Why
`src/core/symbols.ts` and `grimoire map --symbols` were removed from the codebase between Apr 5 and May 17, 2026, in favor of delegating symbol/call-graph queries to the external `codebase-memory-mcp` MCP server. Two artifacts still reference the removed capability:

- `features/intelligence/symbols.feature` — describes scenarios for the deleted extractor (Python/TypeScript/Go/Rust symbol extraction, file-size skip).
- `.grimoire/decisions/0015-symbol-extraction-depth.md` — `accepted` ADR choosing "signatures only, regex extraction" for the now-deleted module.

The feature describes behavior the code no longer implements (a dead feature). The decision is now historical context rather than current policy. This change removes the dead feature and supersedes the decision with a new ADR documenting the delegation.

## Non-goals
- Not deleting ADR 0015 — it stays for historical context and is marked `superseded`.
- Not changing the codebase-memory-mcp integration; it is already in place.
- Not removing ADR-0005 (regex over tree-sitter) — that decision was about extraction *technique* and is no longer applied, but is also part of the historical record. Leave it untouched in this change; future audit can reassess.

## Feature Changes
- **REMOVED** `intelligence/symbols.feature` — covers a CLI capability that no longer exists

## Scenarios Added
None.

## Scenarios Modified
None.

## Decisions
- **ADDED** `0029-delegate-symbol-intelligence-to-codebase-memory-mcp.md` — supersedes 0015; documents the delegation
- **SUPERSEDED** `0015-symbol-extraction-depth.md` — to be marked `superseded` with a link to 0029 when this change is applied
