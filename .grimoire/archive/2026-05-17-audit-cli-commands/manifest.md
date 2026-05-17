---
status: archived
complexity: medium
branch:
design_ref:
archived_on: 2026-05-17
---

# Change: Document 9 CLI commands that ship without Gherkin specs

## Why
Nine `grimoire` subcommands (`update`, `list`, `status`, `diff`, `log`, `docs`, `ci`, `branch-check`, `test-quality`) have full implementations under `src/core/` and `src/commands/` but no `.feature` files. Discovered during `grimoire-audit` on 2026-05-17. Without specs, future changes to these commands cannot be reviewed against intent — only against current behavior.

## Non-goals
- Not changing command behavior — these features document what the commands already do.
- Not refactoring the implementations.
- Not adding new commands.
- Not back-dating ADRs for these commands (they implement existing accepted decisions).

## Feature Changes
- **ADDED** `cli/update.feature` — `grimoire update` migrates AGENTS.md, skills, templates, and config; checks npm registry
- **ADDED** `cli/list.feature` — `grimoire list` enumerates active changes, baseline features, and decisions; detects conflicts
- **ADDED** `cli/status.feature` — `grimoire status <id>` reports a single change's stage and task progress
- **ADDED** `cli/diff.feature` — `grimoire diff <id>` compares proposed scenarios against baseline features
- **ADDED** `cli/log.feature` — `grimoire log` aggregates archived changes into release notes
- **ADDED** `cli/docs.feature` — `grimoire docs` generates `OVERVIEW.md` from features, decisions, area docs, and changes
- **ADDED** `cli/ci.feature` — `grimoire ci` orchestrates validate + check + test-quality with optional GHA annotations; `ci generate` scaffolds a workflow
- **ADDED** `cli/branch-check.feature` — `grimoire branch-check` (Claude Code UserPromptSubmit hook) detects new-feature intent and gates against dirty/mid-feature branches
- **ADDED** `cli/test-quality.feature` — `grimoire test-quality` flags weak tests (empty bodies, missing assertions, tautological conditions, swallowed errors)

## Scenarios Added
See each feature file for scenario list. Post-review additions (2026-05-17):
- `cli/branch-check.feature` — happy-path allow, shell-metacharacter sanitization, length cap, no-persist/transmit (privacy from ADR-0028)
- `cli/ci.feature` — explicit `--annotations` flag scenario, `--skip` scenario
- `cli/diff.feature` — non-existent change error path
- `cli/log.feature` — `--to` filter, git-tag-as-ref scenario
- `cli/test-quality.feature` — `weak-assertion` rule scenario, complete rule-name enumeration in JSON assertion
- `cli/update.feature` — uninitialized-project error path, corrupt-config error path

## Scenarios Modified
Post-review fixes (2026-05-17) to make specs match shipped behavior:
- `cli/log.feature` — `--since` → `--from` (matches `src/commands/log.ts:6`)
- `cli/ci.feature` — `ci generate` subcommand → `ci --setup` flag (matches `src/commands/ci.ts:8`)
- `cli/status.feature` — JSON shape corrected to `{ stage, status, artifacts.tasks: { total, completed } | null }` (matches `src/core/status.ts:11-25`)
- `cli/diff.feature` — uppercase labels (ADDED/REMOVED/MODIFIED) → lowercase + icon prefix (matches `src/core/diff.ts:209-212`); JSON keys aligned to `scenariosAdded/scenariosRemoved/scenariosUnchanged`
- `cli/test-quality.feature` — rule names hyphenated to match `src/core/test-quality.ts` (`empty-body`, `no-assertion`, `tautological`, `swallowed-error`, `weak-assertion`)

## Decisions
None created or superseded.
