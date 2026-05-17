---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Use Vitest as the test framework

## Context and Problem Statement
The grimoire CLI is written in TypeScript with ES modules. It needs a test framework that runs the suite quickly, integrates with TypeScript without a separate compile step, and supports ESM natively. The two mainstream options are Jest (the long-standing default) and Vitest (a younger framework built on Vite).

## Decision Drivers
- Native ESM support without flags or transformation pipelines
- Native TypeScript support (no `ts-jest` config layer)
- Fast watch mode for the inner dev loop
- Familiar `describe`/`it`/`expect` API for contributors coming from Jest
- Active maintenance and community

## Considered Options
1. **Vitest** — modern, ESM-first, TypeScript-first, Jest-compatible API
2. **Jest** — long-standing default, broad community, but ESM/TS support is bolted on via config
3. **Node's built-in `node:test`** — zero deps, but assertion ergonomics and mocking are weaker

## Decision Outcome
Chosen option: **Vitest**, because it gives us native ESM + TypeScript with zero config, a watch mode that's noticeably faster than Jest, and a near-identical API so contributors who know Jest can read the tests immediately. The `vitest.config.ts` in the repo is intentionally minimal — Vitest infers most of what we need from `tsconfig.json` and the project layout.

### Consequences
- Good: Tests run as written TypeScript with no compile step.
- Good: Watch mode rebuilds only affected files; dev loop stays under a second on the current suite.
- Good: `@vitest/coverage-v8` gives us coverage without an extra runner.
- Good: Jest-compatible API means snippets from Jest docs/Stack Overflow usually work.
- Bad: Less mature ecosystem than Jest (some Jest plugins have no Vitest equivalent).
- Bad: Vitest's mocking model differs subtly from Jest in edge cases (auto-mocks, module resets).

### Cost of Ownership
- **Maintenance burden**: One direct dep + one coverage dep. Both move fast; expect minor breaking changes once a year.
- **Ongoing benefits**: Fast feedback loop materially improves the TDD/BDD discipline grimoire itself promotes.
- **Sunset criteria**: Revisit if Vitest is abandoned, if Node's built-in test runner reaches feature parity, or if grimoire needs a feature that only Jest provides.

### Confirmation
Measurable signals:
- `.github/workflows/release.yml` test job duration stays under 60s p95 across the Node 20 + 22 matrix
- New `*.test.ts` files require no entry in `vitest.config.ts` (config remains minimal)
- `grimoire health` test-coverage metric remains computable without per-test config
