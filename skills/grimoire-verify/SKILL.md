---
name: grimoire-verify
description: Verify that implementation matches feature specs and decision records. Use after apply is complete, before committing and opening a PR.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-verify

Verify the complete implementation once after section delivery. This procedure owns Grimoire alignment, deterministic checks, pre-commit review, and final suites. Use `../references/testing-lifecycle.md` for boundary cadence.

## Triggers
- User wants to verify a grimoire change is correctly implemented
- User asks to check, verify, or review a change before committing
- Loose match: "verify", "check", "review" with a change reference

## Routing
- Change not yet applied → `grimoire-apply` first
- Want a pre-implementation design review → `grimoire-review`
- Found issues that need fixing → user decides: fix directly or route to `grimoire-apply` / `grimoire-draft`

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with completed tasks
- Or: user wants to verify baseline features against the codebase (no active change required)

## Workflow

### 1. Select Scope
Two modes:

**Change verification** (default when a change exists):
- Select an active change with completed tasks
- Verify the implementation matches that specific change's features and decisions

**Baseline verification** (when user asks to verify the whole project):
- Verify all features in `features/` against the codebase
- Check all decisions in `.grimoire/decisions/` are still accurate

### 2. Load Artifacts
For change verification:
- Read `manifest.md`, changed live `.feature` files, changed decision records, and `tasks.md`
- Read `baseline.md` if present (the test state captured at change start) — it's how you tell a regression from a failure that was already red

For baseline verification:
- Read all `features/**/*.feature` and `.grimoire/decisions/*.md`

### 3. Run the Ordered Verification Procedure

Run these stages in order:

1. Run `grimoire validate`.
2. Run existing Grimoire-specific static verification.
3. Run configured deterministic non-test checks by explicit step name.
4. Invoke `grimoire-precommit-review` once over the complete diff.
5. Apply one accepted correction batch. Run only the affected section confirmation when needed and applicable deterministic checks.
6. Run each configured unit and BDD suite once.
7. Compare every failure with `baseline.md`.

Do not run the LLM-backed `best_practices` check separately. `grimoire-precommit-review` is the single general code and best-practice review. Select only personas relevant to the change surface.

Do not run final suites before pre-commit review corrections. Do not run another persona review for accepted corrections unless a material boundary changes.

### 4. Grimoire-Specific Static Verification

**A. Completeness — are all tasks done?**
- Parse `tasks.md` and check all items are `- [x]`
- If any are `- [ ]`, list them as CRITICAL issues
- This is objective — checkboxes don't lie

**B. Correctness — does the code match the specs?**
For each executable scenario in the feature files:
1. Search the codebase for the production code that implements this behavior
2. Search for the step definition that tests this scenario
3. Verify the step definition makes real assertions (not empty, not `assert True`, not `pass`)
4. If possible, confirm the test actually runs (check test output, CI results)

For a feature tagged `@manual`, use its declared characterization or unit contract instead of requiring Cucumber step definitions. Verify that the contract asserts the scenario's workflow intent.

Flag issues:
- Executable scenario with no corresponding step definition → CRITICAL
- `@manual` scenario with no corresponding characterization or unit contract → CRITICAL
- Step definition with empty/trivial body → CRITICAL
- Step definition that doesn't match the scenario's intent → WARNING
- Production code not found for a scenario → WARNING (may be indirect)

**C. Coherence — does the implementation follow the decisions?**
For each decision record:
1. Read the chosen option and consequences
2. Search the codebase for evidence the decision was followed
3. Check the Confirmation section — has the criteria been met?

Flag issues:
- Decision says "use PostgreSQL" but code uses SQLite → CRITICAL
- Decision's Confirmation criteria not verifiable → WARNING
- Decision consequences not addressed → WARNING

### 4.C2 Regression Classification

After the pre-commit review and correction stage, classify final suite failures against `baseline.md`:

- Failing now **and** in the baseline → **pre-existing**, already accepted by the user at change start. Not a regression. Do not blame the change.
- Failing now, **not** in the baseline → **regression** introduced by this change → CRITICAL. Must be fixed before the change finalizes.
- Passing now, failing in the baseline → incidentally fixed; note it, don't require it.
- **No `baseline.md` / baseline skipped** → you cannot classify. List all failures and say plainly they're untriaged. Do NOT assert "existing tests pass" or call anything "pre-existing" without a baseline to back it.

The rule: a failure is "pre-existing" only if it's in `baseline.md`. Otherwise it's the change's. Full protocol: `../references/test-baseline.md`.

### 3.D Test Quality Intelligence

Go beyond "does a step definition exist?" to "would this test catch a real bug?"

For each step definition:
1. **Assertion strength:** Classify each assertion:
   - **Strong:** `assert result == "expected_value"`, `expect(status).toBe(302)`, `assertEqual(user.email, "test@example.com")`
   - **Weak:** `assert result is not None`, `expect(result).toBeDefined()`, `assert len(items) > 0`
   - **Trivial:** `assert True`, `pass`, empty body, `expect(true).toBe(true)`

2. **Null implementation test:** Could this test pass if the function under test returned `None`, `[]`, `{}`, or `0`? If yes, the test is too weak.

3. **Common anti-patterns to flag:**
   - Step definition body is just `pass` or `...` → CRITICAL
   - Assertion only checks `is not None` or `toBeDefined()` → WARNING
   - Assertion checks type only (`isinstance()`) without checking value → WARNING
   - Test creates a mock and then asserts against the mock's return value (circular) → CRITICAL
   - Try/except that swallows assertion errors → CRITICAL
   - Step definition has no `assert`/`expect` at all → CRITICAL (for Then steps)
   - Test mocks internal code that lives in the same repo → WARNING (hides integration bugs)
   - Test mocks so aggressively that removing production code still passes → CRITICAL

4. **Report format:** Include test quality findings alongside correctness findings:
   ```
   - **[critical]** `test_auth.py:42` — step "Then I should be redirected" has no assertion (empty body)
   - **[warning]** `test_auth.py:58` — step "Then user should exist" only asserts `is not None` — check the actual user properties
   ```

**Regression coverage:** When verifying a bug fix, confirm the fix ships with a regression test **named after the bug** (see `grimoire-bug`). A bug fix with no test that goes red-without-the-fix and pins the defect → WARNING — the bug can silently return.

If `grimoire test-quality` CLI command is available, suggest running it for a comprehensive analysis.
To run tests directly: use `config.tools.bdd_test` for BDD and `config.tools.unit_test` for unit tests.

### 3.E Behavioral Verification *(optional — user-facing changes only)*

Sections 3.B–3.D verify statically (code exists, asserts, follows decisions) and run the configured suites. They do **not** drive the running app. When the change is user-facing and the app can be run, add a behavioral pass; otherwise skip and say so. This mode adds **no mandatory dependency** — if there's no way to drive the app, mark it INCONCLUSIVE and rely on 3.A–3.D.

**Read-only by default.** Read-only navigation/inspection needs no opt-in. Any state-changing action requires explicit user opt-in **and** a non-production target (local/staging URL, seeded creds). Never run mutations against production.

**Verdict.** Every behavioral pass ends in exactly one:
- **SHIP** — behavior matches the spec; no material issues.
- **SHIP WITH FIXES** — works, with the non-blocking issues listed.
- **DO NOT SHIP** — a scenario's promised outcome does not hold.
- **INCONCLUSIVE** — could not verify (no baseline, app wouldn't run, tooling absent).

**No baseline ⇒ INCONCLUSIVE, never a silent PASS.** Same rule as §3.C2: without a reference state you cannot claim behavior is correct. Report INCONCLUSIVE and fall back to static verification — do not dress up "I couldn't check" as a pass.

**Click-path final-state check.** For each touchpoint the change affects, build a side-effect map — `action → {state it sets, state it resets}` — then trace the sequence and ask: *is the FINAL state what the label/spec promises?* This catches the silent-undo class (action B resets what action A just set) that static reading and single-assert tests miss.

### 4. Security Compliance Verification

Verify that security guidance from plan and review stages was followed in implementation. Read `../references/security-compliance.md` for the full checklist.

**A. Check plan-stage security patterns:**
Confirm the implementation uses proven patterns: framework auth (not custom), bcrypt/argon2 (not MD5/SHA), parameterized queries (not string concatenation), CSRF protection, input validation at boundary, no hardcoded secrets.

**B. Check review findings were addressed:**
If a `grimoire-review` was run, list each **blocker** from the Security Engineer review. Search the implementation for evidence each was fixed. Unaddressed blockers → CRITICAL.

**C. OWASP Top 10 surface scan:**
Scan changed files against the OWASP table in `../references/security-compliance.md`. Tag findings with OWASP category and CWE ID.

**D. Verify security-tagged scenarios:**
Check feature files for security tags. For each, verify per the rules in `../references/security-compliance.md`. A security-tagged scenario with no security verification in tests → CRITICAL.

If no security tags exist and the change has no security surface, state so briefly and move on.

### 5. Contract Test Coverage

For changed external boundaries, apply `../references/testing-contracts.md`. Compare the live schema diff, client usage, and authoritative contract tests. Report missing or fictional evidence without inventing replacement fixtures or assertions. Skip when the change has no external boundary.

### 6. Dead Feature Detection
Check for features that exist in specs but may no longer be implemented:
- Feature files with no corresponding step definitions anywhere
- Step definitions that import modules/functions that no longer exist
- Step definitions with `pass` or `NotImplementedError` bodies
- Features tagged `@skip` or `@wip` that have been in that state for a long time

### 6b. Code Quality Audit

For every production file changed in this implementation, run an independent quality check — not a re-read of what the implementing agent self-reported.

**A. Walk the seven-point checklist from `../references/code-quality.md` on each changed file:**

1. **Reuse before write** — any new helper/function that duplicates existing code? Flag the duplicate and the existing function.
2. **Branching budget** — any function with more than ~7 branches (`if`/`else`/`case`/ternary/`&&`/`||`)? Name it and count.
3. **Function size** — any function body over ~30 lines? Flag it. "One job per function" — if the name needs "and", it's two functions.
4. **Defensive code inside trust boundary** — `if x is None` guards on non-nullable types, `isinstance` checks on values the codebase just built, `try/except` with no real recovery? Flag each.
5. **Names** — any local named `data`, `result`, `temp`, `info`, `obj`, `item`, or `value` when a specific name would fit?
6. **Premature abstraction** — any new `BaseX`, factory, strategy, config object, or registry pattern with a single caller? Any wrapper function that only renames arguments?
7. **Comments** — any comment that restates the code (`# loop over users`), references the current task/PR/ticket, is a multi-line docstring on a private function, or whose removal would not confuse a future reader?

**B. Classify findings:**
- **[critical]** — premature abstraction (new base class / factory / strategy for one caller), or dead code (function/class written but never called)
- **[warning]** — function too large, too many branches, defensive guards inside trust boundary, generic names
- **[suggestion]** — comment noise, minor naming issue

**C. Report format:**
```
## Code Quality
- [ ] **[critical]** `src/auth.ts:12` — `BaseTokenValidator` has one subclass; inline it
- [ ] **[critical]** `src/auth.ts:88` — `_validate_helper` never called outside `validate()`; inline it
- [ ] **[warning]** `src/auth.ts:45` — `process_request` is 62 lines with 9 branches; split by responsibility
- [ ] **[suggestion]** `src/auth.ts:31` — comment "# check if token is expired" restates the code; remove
```

If no issues: `## Code Quality — clean`.

### 5. Deterministic Checks

Read `.grimoire/config.yaml`. Select configured non-test checks whose commands are deterministic. Pass their explicit step names to `grimoire check`; do not run unselected checks.

Exclude `unit_test` and `bdd_test` until the final suite stage. Exclude any LLM-backed check, including `best_practices`; pre-commit review owns that judgment.

For this repository, the configured command is:

```sh
node bin/grimoire.js check lint format duplicates complexity dead_code security dep_audit secrets doc_style --changed
```

If a deterministic check fails, apply the diagnosis gate in `../references/testing-lifecycle.md` before another check or test execution. Do not hide it inside the later persona review.

### 6. Pre-Commit Review and Corrections

Invoke `grimoire-precommit-review` once over the complete diff, including staged and unstaged change-related files. Select only personas relevant to the change surface. The review supplies the single general code and best-practice review with one accepted correction batch.

After accepted corrections, run only the affected section confirmation when needed and applicable deterministic checks. Do not rerun the persona review unless scope, architecture, trust boundaries, data schemas, public APIs, acceptance criteria, or production entry points materially changed.

### 7. Final Suites and Baseline Comparison

Run each configured unit and BDD suite once. Do not run either suite when it already ran after pre-commit review corrections through another verify step; one invocation per configured suite is the limit.

Compare every failure with `baseline.md`. A failure absent from the accepted baseline is new and blocks finalization. A failure present in the baseline remains pre-existing. Without an accepted baseline, list failures as unclassified.

Apply the diagnosis gate in `../references/testing-lifecycle.md` to every final-suite failure before a focused rerun. Do not rerun passing suites or add a duplicate feature-complete command.

### 8. Generate Report
Produce a structured report:

```markdown
# Verification Report: <change-id or "baseline">

## Summary
- Scenarios verified: X
- Decisions verified: X
- Security checks: X passed, X failed
- Behavioral verdict: <SHIP | SHIP WITH FIXES | DO NOT SHIP | INCONCLUSIVE | n/a (static only)>
- Issues found: X critical, X warnings, X suggestions

## Critical Issues
- [ ] <issue description> — `file:line`

## Security Compliance
- [x] Verified: <security pattern confirmed> — `file:line`
- [ ] **[critical]** [OWASP/CWE tag] <violation> — `file:line`
- [ ] **[warning]** [OWASP/CWE tag] <concern> — `file:line`

## Code Quality
- [ ] **[critical/warning/suggestion]** <issue> — `file:line`

## Warnings
- [ ] <issue description> — `file:line`

## Suggestions
- [ ] <suggestion> — `file:line`

## Verified Scenarios
- [x] "Scenario name" in `feature/file.feature` — step def in `test_file.py:42`
- [x] ...
```

### 8. Recommend Next Steps
Based on the report:
- **All clear** → recommend `grimoire-pr`, which invokes Apply finalization before opening the PR
- **Critical issues** → must fix before committing
- **Warnings only** → user decides whether to fix or accept
- **Dead features found** → suggest a removal change or updating the features

## Important
- Static verification and review findings are reported before correction. Apply only user-accepted review corrections in one batch.
- Correction verification uses only the affected section confirmation when needed. Final configured suites run once after corrections.
- **"Should pass" is not evidence.** Declaring done without running is the *Declaring done without verifying* rationalization in `../references/red-flags.md`. Observe state, don't predict it.
- Be specific: reference file paths and line numbers for every issue.
- An executable scenario without a step definition is always CRITICAL. A `@manual` scenario requires its declared characterization or unit contract instead.
- A step definition with no assertions is always CRITICAL — it's a false positive.
- Don't verify implementation details — only verify that the behavior described in the scenario is covered.
- For baseline verification, this may take a while on large codebases. Present results incrementally by capability.

## Done
When the verification report is presented, the workflow is complete. Suggest next steps based on findings:
- **All clear** → `grimoire-pr`
- **Critical issues** → must fix before committing
- **Warnings only** → user decides whether to fix or accept
