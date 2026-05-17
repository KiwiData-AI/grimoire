---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Colocate test files next to source

## Context and Problem Statement
TypeScript/JavaScript projects typically choose between two test file layouts: tests in a top-level `tests/` mirror tree, or tests colocated next to the source they cover (`detect.ts` and `detect.test.ts` in the same directory). Grimoire needs a convention so new tests land in a predictable place.

## Decision Drivers
- Easy to find the test for a given source file
- Easy to delete a module along with its tests
- No path-mapping required (`../../tests/core/detect.test.ts` becomes `./detect.test.ts`)
- Friendly to grimoire's own area docs (tests appear in the same area)

## Considered Options
1. **Colocate** — `src/core/detect.ts` and `src/core/detect.test.ts` in same directory
2. **Mirror tree** — `tests/core/detect.test.ts` mirroring `src/core/detect.ts`
3. **`__tests__` subdirectory** — `src/core/__tests__/detect.test.ts`

## Decision Outcome
Chosen option: **Colocate**, because it makes the relationship between source and test immediately visible in any file listing, simplifies import paths (always `./<module>.js`), and ensures that when a module is moved or deleted, its tests come along automatically. Vitest's default `**/*.test.ts` glob picks them up with no configuration.

### Consequences
- Good: One-glance discovery — open the directory, see the test file next to the source.
- Good: Refactors that move files don't break test imports.
- Good: `grimoire discover` reports source and test counts per area accurately because they live together.
- Bad: Source directories are noisier (file count roughly doubles).
- Bad: If we ever want to publish a subset of `src/` as a library, we'd need to filter out `*.test.ts` files (already handled by `tsconfig.json` and the published `dist/`).

### Cost of Ownership
- **Maintenance burden**: Minimal — when a source file moves, its test must move with it (one extra `git mv`). No structural overhead beyond that.
- **Ongoing benefits**: New contributors don't have to ask where tests go.
- **Sunset criteria**: Revisit if directory noise becomes a real productivity drag, or if we add a heavy integration-test suite that doesn't fit per-module.

### Confirmation
Measurable signals:
- Every non-test `.ts` file under `src/` (excluding `src/cli/index.ts` and pure type files) has a sibling `*.test.ts` — checkable with a one-line script in `grimoire health`
- No `tests/` or `__tests__/` directory appears under `src/`
