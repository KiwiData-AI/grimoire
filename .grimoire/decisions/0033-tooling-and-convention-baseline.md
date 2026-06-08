---
status: accepted
date: 2026-06-08
decision-makers: [Fred]
---

# Tooling and convention baseline

## Context and Problem Statement

The grimoire CLI makes a handful of tooling and convention choices that are the industry default for a TypeScript/ESM Node project: a test runner, a CLI parser, a git wrapper, a duplicate detector, a test-file layout, and the ESM import style. Each is the obvious pick with no project-specific trade-off — none is a novel decision. They were originally backfilled as one ADR per choice (former 0021–0027), which is itself over-documentation: a reader scanning the register for real architectural decisions has to wade through seven records that each say "we used the standard tool."

This record consolidates them. It exists so the conventions are written down once, not to justify a trade-off. Only the **load-bearing rules** (the parts that govern where future code goes) are kept; the alternatives-considered narrative lives in git history.

## Decision Outcome

| Choice | Pick | Why (industry default) |
|--------|------|------------------------|
| Test framework | **Vitest** | Native ESM + TypeScript, no compile step, Jest-compatible API. Config inferred from `tsconfig.json`. |
| CLI parser | **commander.js** | Declarative subcommand API maps onto one-file-per-command (`src/commands/*.ts`); zero deps, mature. |
| Git access | **simple-git** | Typed promise API over the system `git` binary; handles output parsing across versions; no native build. |
| Duplicate detection | **jscpd** | Node dev-dep, multi-language, JSON output consumed by `health`/`discover`; runs as a child process so a detector failure can't crash the command. |
| Test-file layout | **Colocated** | `foo.ts` + `foo.test.ts` in the same directory. One-glance discovery; moves/deletes carry tests along; Vitest's `**/*.test.ts` glob needs no config. |
| Module system | **ESM with `.js` import suffixes** | `package.json` `"type": "module"`, `tsconfig` `"module": "NodeNext"`. Modern deps (chalk ≥5, commander ≥14) are ESM-only; Node's resolver needs the exact runtime extension, so internal imports reference `./<name>.js` from `.ts` source. |

### Load-bearing conventions

These govern where new code goes — follow them:

- **Git access goes through simple-git** in `src/core/`, with one exception: **hot-path hooks** (`src/core/branch-check.ts` runs on every Claude `UserPromptSubmit`) may call `git` directly via `execFile` for one or two simple, stable plumbing commands (`git branch --show-current`, `git status --porcelain`) to avoid startup cost. New code in that category may use `execFile`; everything else uses simple-git.
- **Shared init/update logic lives in `src/core/shared-setup.ts`.** `init.ts` (first-time setup) and `update.ts` (refresh) share directory scaffolding, marker-based AGENTS.md block upserts, and skill/template installation. Neither imports from the other; both import the shared module. New logic common to both goes there, not duplicated.
- **Internal imports carry the `.js` suffix** even though the source is `.ts`. This surprises newcomers but is the canonical TypeScript+ESM pattern.

### Consequences

- Good: One record for the whole tooling baseline instead of seven; the register now reads as real decisions plus this baseline.
- Good: The load-bearing conventions (simple-git exception, shared-setup home, ESM suffix) are preserved verbatim.
- Bad: The full alternatives-considered narrative for each pick is now only in git history (former ADRs 0021–0027).

### Sunset criteria

Revisit an individual row only if its default stops being the default (e.g. the ecosystem moves off `.js`-suffix ESM, or a tool is abandoned). A revisit that involves a real trade-off gets its own ADR; a like-for-like swap just updates the row.
