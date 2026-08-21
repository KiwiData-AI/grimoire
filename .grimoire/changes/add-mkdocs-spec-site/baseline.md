# Test Baseline — add-mkdocs-spec-site

Captured: 2026-08-21, branch `feat/add-mkdocs-spec-site`, before any implementation.

## Unit (`npx vitest run`)
24 files, 437 tests — all passed. No pre-existing failures.

## BDD (`npm run test:bdd`)
23 scenarios: 21 passed, 2 undefined.
131 steps: 123 passed, 4 skipped, 4 undefined.

The 2 undefined scenarios are this change's own (`generate-a-spec-site.feature`) — the expected red, not pre-existing failures. Every previously existing scenario passes.

## Verdict
Clean baseline. Any failure at verify that is not one of the two new scenarios is a regression.
