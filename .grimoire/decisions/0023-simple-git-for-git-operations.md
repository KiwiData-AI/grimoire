---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Use simple-git for git interactions

## Context and Problem Statement
Several grimoire commands (`pr`, `trace`, `branch-check`, `commit`, hooks) need to read git state — current branch, uncommitted changes, commit history, trailers, log lines. We can either shell out to `git` directly via `child_process` or use a library wrapper.

## Decision Drivers
- Avoid hand-parsing `git` text output (formats vary across versions and locales)
- Promise-based API to fit our async codebase
- Cross-platform (Windows users matter)
- No native compilation (grimoire is pure JS for portability)

## Considered Options
1. **simple-git** — pure JS wrapper that shells out to `git` and parses output for you
2. **isomorphic-git** — pure-JS git implementation (no system git needed)
3. **Hand-roll via `child_process.execFile`** — direct calls, parse text ourselves
4. **nodegit** — native bindings, fast, but requires compilation

## Decision Outcome
Chosen option: **simple-git**, because it gives us a typed promise-based API on top of the system `git` binary, handles output parsing across `git` versions, and works on Windows/Mac/Linux without any native build step. It assumes `git` is on `PATH`, which is already a requirement for using grimoire at all.

**Scope exception — hot-path hooks.** `src/core/branch-check.ts` runs on every Claude `UserPromptSubmit` event and shells out to `git` via `execFile` (rather than simple-git) for two calls: `git branch --show-current` and `git status --porcelain`. Both are simple, well-defined, and stable across git versions; using simple-git here would add startup cost on the hot path with no readability gain. New code in this category (hot-path hooks calling one or two stable git plumbing commands) may use `execFile` directly. All other git access in `src/core/` should use simple-git.

### Consequences
- Good: We read structured results (`status.modified`, `status.staged`, etc.) instead of regex-matching `git status --porcelain`.
- Good: Pure JS dep — no native compilation, no platform-specific binaries.
- Good: Maintained, typed, and the API is small.
- Bad: Adds a runtime dependency (small).
- Bad: Output parsing edge cases occasionally leak through; rare but possible across `git` versions.

### Cost of Ownership
- **Maintenance burden**: One direct dep; stable release cadence.
- **Ongoing benefits**: We don't re-discover `git`'s text output quirks every time we add a feature.
- **Sunset criteria**: Revisit if simple-git is abandoned, if we need pure-JS git for an environment without `git` installed (→ isomorphic-git), or if a single library can't cover an edge case we hit.

### Confirmation
Measurable signals:
- New non-hot-path git access in `src/core/` uses `simpleGit(...)`; raw `execFile("git", ...)` outside of `branch-check.ts` is rejected at review
- `grep -rn 'execFile.*"git"' src/core/` returns only the documented `branch-check.ts` callsites
- Cross-platform CI (when added) passes on Windows runners without git-text-parsing fixes
