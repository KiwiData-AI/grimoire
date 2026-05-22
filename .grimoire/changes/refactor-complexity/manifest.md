# refactor-complexity

**Type:** refactoring  
**Status:** in-progress  
**Debt items:** debt-001, debt-002, debt-003, debt-004, debt-005, debt-006, debt-007, debt-008, debt-009

## Goal

Reduce cyclomatic complexity across the highest-severity violations to bring all functions under the ESLint threshold of 10. No behaviour changes — existing tests must continue to pass.

## Scope

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

Extract focused helper functions. No new abstractions, no new files unless a grouping is obvious. Each extracted helper must be independently testable.
