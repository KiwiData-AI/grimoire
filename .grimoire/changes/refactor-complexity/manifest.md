---
status: implementing
branch: refactor-complexity
complexity: 3
---

# refactor-complexity

## Why

Several functions exceed the ESLint cyclomatic-complexity threshold of 10, making
them hard to test and reason about. Reduce the highest-severity violations to bring
all functions under the threshold. No behaviour changes — existing tests must
continue to pass. Done when every function below is under 10 and the suite is green.

## Non-goals

- No behaviour changes — this is a pure refactor.
- No new abstractions or files unless an obvious grouping emerges.
- Not addressing complexity below the threshold (only the listed violations).

## Feature Changes

None — internal refactoring only. No feature behaviour changes, so no `.feature`
files are added, modified, or removed.

## Decisions

None — no architecture decision is created or superseded. The extraction strategy
(focused, independently testable helpers) is an implementation detail, not an ADR.

## Scope

Debt items: debt-001 … debt-009.

| File | Function | Before | Target |
|------|----------|--------|--------|
| `src/core/init.ts` | `initProject` | 34 | <10 |
| `src/core/init.ts` | `buildDetectedConfig` | 25 | <10 |
| `src/utils/config.ts` | `parseProject` | 24 | <10 |
| `src/core/ci.ts` | `runCi` | 30 | <10 |
| `src/core/diff.ts` | `printDiff` | 23 | <10 |
| `src/core/check.ts` | `runStep` | 19 | <10 |
| `src/core/check.ts` | `runLlmStep` | 14 | <10 |
| `src/core/map.ts` | `generateMap` | 20 | <10 |
| `src/core/map.ts` | `scanDirectory` | 18 | <10 |
| `src/core/validate.ts` | `validateFeatureFile` | 20 | <10 |

## Approach

Extract focused helper functions. No new abstractions, no new files unless a
grouping is obvious. Each extracted helper must be independently testable.
