---
status: implementing
complexity: 3
branch: feat/adopt-ecc-dev-patterns
design_ref: .grimoire/changes/adopt-ecc-dev-patterns/draft.md
---

# Change: Adopt ECC-derived dev-discipline patterns

## Why
A review of `github.com/affaan-m/ECC` surfaced strong dev-discipline mechanisms under agent-OS
sprawl. Adopt seven that harden existing grimoire surfaces (review, verify, bug, audit, skill
authoring, ADR handling) with concrete mechanisms — no new agent-OS surface. Solved when each
mechanism lives in its one home and the existing skills reference it.

## Non-goals
- No agent-OS surface (continuous-learning daemons, cost telemetry, fleet orchestration,
  per-language agent/command packs, marketplaces).
- No new CLI commands or CI checks.
- No mandated browser/MCP tooling (run-the-app verify is opt-in, degrades to INCONCLUSIVE).
- No hand-maintained ADR index (DRY — see draft D5).

## Feature Changes
- (none) — targets are skill prose, references, one ADR, and CONTRIBUTING. Skills are pure
  markdown ([0010]); nothing passes the four-gate feature admission test.

## Scenarios Added
- (none)

## Scenarios Modified
- (none)

## Decisions
- **ADDED** `0036-capability-surface-selection.md` (proposed) — where a capability belongs
  (rule/skill vs CLI vs MCP vs reference). Builds on [0010], [0030], [0032].

## Other artifacts
- **MODIFIED** `skills/references/review-personas.md` — Pre-Report Gate + false-positive catalog;
  reviewer-flags-missing-ADR.
- **MODIFIED** `skills/grimoire-bug/SKILL.md` — regression-test naming + mechanical-gate-before-self-review.
- **MODIFIED** `skills/grimoire-verify/SKILL.md` — optional Behavioral Verification mode (verdict enum + INCONCLUSIVE).
- **MODIFIED** `skills/grimoire-audit/SKILL.md` — deterministic detection + prioritized output.
- **MODIFIED** `CONTRIBUTING.md` — capability-surface pointer; skill-authoring leanness convention.
- **MODIFIED** `AGENTS.md` — ADR lifecycle + supersession links.
- **MODIFIED** `.grimoire/decisions/template.md` — add `deprecated` to status vocabulary.
