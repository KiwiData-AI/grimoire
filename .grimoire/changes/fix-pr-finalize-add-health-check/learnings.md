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
- fact: templates/manifest.md has no `date:` frontmatter field — manifest-date staleness was dead code with real manifests; folder age must come from git (`git log -1 --format=%ct -- <folder>`) → home: none (fixed in health.ts)
- fact: OVERVIEW.md's auto-generated marker is on line 3 (title, blank, marker) — a "first two lines" marker check misses it; health.ts scans the first 4 → home: none (tooling detail)
- fact: register citations often name test files by bare basename (`pr.ts`) — content grep alone false-positives them; check `git ls-files` for the basename first → home: none (fixed in health.ts)
- fact: the decision-ref sweep self-matches health.ts's own grep pattern literal (`"ADR-[0-9]|decisions/0"` at src/core/health.ts:488) — non-test source is in scope by §B#4, so it stays as a permanent known hit on this repo → home: none (accepted noise; coordinator may decide otherwise)
- fact: `grimoire pr` (src/core/pr.ts) reads manifest.md/tasks.md/artifacts from the change folder on disk with no git fallback — description generation must happen before apply §7 step 6 removes the folder; pr skill step 5 carries one ordering line, acceptance 7.4 must sequence the CLI run accordingly → home: skills/grimoire-pr/SKILL.md (landed)
- fact: `category: deferred-task` (plan-specified for deferred-task debt entries) is absent from refactor-register-format.md's category enum — the register format may need the category added, or the enum treated as open → home: skills/references/refactor-register-format.md (resolved: task 6.2 added `deferred-task` to the enum, hyphenated to match the pr skill)
- fact: AGENTS.md Conventions gained "### ADR Bar" and "### Constraints Register" — the normative homes health-check.md's Policies section cites; the invariant bullet + `/grimoire:pr` stage rename landed in the Workflow section → home: AGENTS.md (landed)
