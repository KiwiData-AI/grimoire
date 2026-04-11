---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Use managed block markers for AGENTS.md and README badges

## Context and Problem Statement
Grimoire needs to insert and update content in files that the user also edits (AGENTS.md, README.md). How should grimoire own its sections without overwriting user content?

## Decision Drivers
- Users must be able to add their own content to AGENTS.md above/below grimoire's section
- `grimoire update` must be idempotent — safe to run repeatedly
- Markers must survive manual edits to surrounding content
- Must work for both AGENTS.md instructions and README health badges

## Considered Options
1. Managed block markers — `<!-- GRIMOIRE:AGENTS:START -->` / `<!-- GRIMOIRE:AGENTS:END -->` HTML comments
2. Separate file — grimoire owns a dedicated file, user owns AGENTS.md
3. Full file ownership — grimoire owns the entire AGENTS.md
4. Append-only — grimoire appends to the end, never modifies existing content

## Decision Outcome
Chosen option: "Managed block markers", because HTML comments are invisible in rendered markdown, survive all markdown parsers, and clearly delineate grimoire's section. `grimoire update` replaces content between markers without touching anything outside. The same pattern works for README health badges (`<!-- GRIMOIRE:HEALTH:START/END -->`).

### Consequences
- Good: User content is preserved across updates
- Good: Idempotent — update replaces only the managed section
- Good: Visible in source but invisible in rendered markdown
- Good: Reusable pattern for any file grimoire needs to partially own
- Bad: Users who delete a marker break the update mechanism
- Bad: Two managed blocks in the same file require unique marker names

### Confirmation
If `grimoire update` preserves user-added content in AGENTS.md while correctly updating grimoire's managed block, the decision is validated.
