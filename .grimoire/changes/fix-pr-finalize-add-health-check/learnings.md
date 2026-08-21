# Learnings — fix-pr-finalize-add-health-check

<!--
  Ephemeral working memory for this change. Lives only in
  `.grimoire/changes/<change-id>/` and is **removed at finalize** with the rest
  of the scaffolding — nothing here persists to the repo. Re-read it at the start
  of every task section and before every retry.

  Two sections, two lifecycles. Keep them separate; never write either into
  `AGENTS.md`.
-->

## Failure-mode notes

Format: `- <task-id> · tried <approach> · failed: <observed error / why>`

## Discovered facts

Format: `- fact: <what was learned> → home: <area doc | decision | constraint | schema | feature>`

- fact: spec 2B has no severities, but task 2.3 requires "severity per health-check.md §B" — severities were assigned in §B (terminal ADR = review, matching 2.2's pinned expectation) → home: skills/references/health-check.md (already landed)
- fact: the comment-lint write hook scans string literals that look like comments — a test fixture `"src/auth.ts:12:  // decided in ADR-0007"` was blocked as external_ref; drop the `//` from fixture strings → home: none (tooling quirk, working memory only)
- fact: health.test.ts's child_process mock impl survives `vi.clearAllMocks()` — per-test `mockImplementation` on the promisify.custom fn leaks across tests; the top-level beforeEach now resets it to `{ stdout: "" }` → home: none (test fixture, landed in health.test.ts)
- fact: BDD temp projects have an unborn `main` (init commits nothing) — every `git log main` consumer must catch and degrade, as checkSpecDrift does → home: none (already handled in code)
