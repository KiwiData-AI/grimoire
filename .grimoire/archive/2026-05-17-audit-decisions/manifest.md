---
status: draft
complexity: medium
branch:
design_ref:
---

# Change: Backfill 8 architecture decisions for implementation choices

## Why
Several implementation choices visible in the codebase (test framework, CLI library, git wrapper, dup-detection tool, code organisation patterns, hook strategy) have no ADR. They were chosen during build-out without explicit decision records. Discovered during `grimoire-audit` on 2026-05-17. Backfilling these gives future contributors the reasoning so they can evaluate whether to keep, change, or extend the choice instead of guessing intent.

## Non-goals
- Not changing any of the implementations.
- Not re-litigating the choices; these record the choice as it stands today, with reasoning for the chosen option.
- Not creating ADRs for trivially-obvious choices ("we use TypeScript", "we use Node").

## Feature Changes
None — these are decision-only changes.

## Scenarios Added
None.

## Scenarios Modified
None.

## Decisions
- **ADDED** `0021-vitest-as-test-framework.md` — why vitest over jest
- **ADDED** `0022-commander-for-cli.md` — why commander.js over yargs/clipanion
- **ADDED** `0023-simple-git-for-git-operations.md` — why simple-git over shelling out
- **ADDED** `0024-jscpd-for-duplicate-detection.md` — why jscpd
- **ADDED** `0025-colocated-test-files.md` — `*.test.ts` next to source
- **ADDED** `0026-esm-with-js-import-suffix.md` — ES modules and the TS+ESM `.js` import quirk
- **ADDED** `0027-shared-setup-module-pattern.md` — extracting init/update commonality into `shared-setup.ts`
- **ADDED** `0028-intent-gated-branch-guard.md` — Claude UserPromptSubmit hook + new-feature intent regex (composes with, does not supersede, ADR-0012 dual-hook-strategy)
