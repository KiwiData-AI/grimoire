---
name: grimoire-verify
description: Verify that implementation matches feature specs and decision records. Use after apply is complete, before archiving the change.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-verify

Verify that implementation matches the feature specs and decision records. Run after apply, before archive.

## Triggers
- User wants to verify a grimoire change is correctly implemented
- User asks to check, verify, or review a change before archiving
- Loose match: "verify", "check", "review" with a change reference

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
- Read `manifest.md`, proposed `.feature` files, decision records, `tasks.md`

For baseline verification:
- Read all `features/**/*.feature` and `.grimoire/decisions/*.md`

### 3. Verify in Three Dimensions

**A. Completeness — are all tasks done?**
- Parse `tasks.md` and check all items are `- [x]`
- If any are `- [ ]`, list them as CRITICAL issues
- This is objective — checkboxes don't lie

**B. Correctness — does the code match the specs?**
For each scenario in the feature files:
1. Search the codebase for the production code that implements this behavior
2. Search for the step definition that tests this scenario
3. Verify the step definition makes real assertions (not empty, not `assert True`, not `pass`)
4. If possible, confirm the test actually runs (check test output, CI results)

Flag issues:
- Scenario with no corresponding step definition → CRITICAL
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
   - Test mocks the client wrapper instead of the HTTP boundary → WARNING (tests wiring, not contract compliance)
   - Test mocks internal code that lives in the same repo → WARNING (hides integration bugs)
   - Contract test uses a fixture that doesn't match `schema.yml` → CRITICAL (fictional contract)
   - Test mocks so aggressively that removing production code still passes → CRITICAL

4. **Report format:** Include test quality findings alongside correctness findings:
   ```
   - **[critical]** `test_auth.py:42` — step "Then I should be redirected" has no assertion (empty body)
   - **[warning]** `test_auth.py:58` — step "Then user should exist" only asserts `is not None` — check the actual user properties
   ```

If `grimoire test-quality` CLI command is available, suggest running it for a comprehensive analysis.
To run tests directly: use `config.tools.bdd_test` for BDD and `config.tools.unit_test` for unit tests.

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

Verify that every external API integration has contract tests that match the documented contract.

**A. Inventory external APIs:**

Read `.grimoire/docs/data/schema.yml` and list every entry with `type: external_api`. For each:

1. **Contract documented?** Check that the entry has `endpoints` with `request`, `response`, and `error_response` shapes. Missing contract documentation → WARNING (the contract is implicit and untested)

2. **Contract test exists?** Search the test suite for tests that validate the client against the documented response shape. Look for:
   - Tests that assert specific response fields match expected types/values
   - Tests that use fixture/recorded responses matching the `schema.yml` shape
   - Tests that verify error handling matches the documented `error_response`
   - Missing contract test for a documented API → CRITICAL

3. **Contract test matches schema?** Compare the fixture/recorded response used in tests against the `schema.yml` contract:
   - Fixture has fields not in `schema.yml` → WARNING (undocumented dependency)
   - `schema.yml` has `required: true` fields not asserted in tests → WARNING (untested contract guarantee)
   - Client reads fields not in `schema.yml` → CRITICAL (invisible contract dependency)

4. **Contract drift?** If this is a change verification (not baseline), compare `data.yml` against `schema.yml`:
   - Any field changes on external APIs without corresponding test updates → CRITICAL
   - New endpoints without contract tests → CRITICAL

**Report format:**
```markdown
## Contract Coverage
- [x] `stripe_api` — 3 endpoints, all with contract tests in `tests/integrations/test_stripe.py`
- [ ] **[critical]** `github_api.get_user` — no contract test found for response shape
- [ ] **[warning]** `sendgrid_api` — contract documented but `error_response` shape missing
- [ ] **[critical]** `payments_api` — client reads `transaction.metadata.source` not in schema.yml (undocumented field dependency)
```

If no external APIs exist in `schema.yml`, skip this section.

### 6. Dead Feature Detection
Check for features that exist in specs but may no longer be implemented:
- Feature files with no corresponding step definitions anywhere
- Step definitions that import modules/functions that no longer exist
- Step definitions with `pass` or `NotImplementedError` bodies
- Features tagged `@skip` or `@wip` that have been in that state for a long time

### 7. Generate Report
Produce a structured report:

```markdown
# Verification Report: <change-id or "baseline">

## Summary
- Scenarios verified: X
- Decisions verified: X
- Security checks: X passed, X failed
- Issues found: X critical, X warnings, X suggestions

## Critical Issues
- [ ] <issue description> — `file:line`

## Security Compliance
- [x] Verified: <security pattern confirmed> — `file:line`
- [ ] **[critical]** [OWASP/CWE tag] <violation> — `file:line`
- [ ] **[warning]** [OWASP/CWE tag] <concern> — `file:line`

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
- **All clear** → recommend archiving the change
- **Critical issues** → must fix before archiving
- **Warnings only** → user decides whether to fix or accept
- **Dead features found** → suggest a removal change or updating the features

## Important
- Verify is read-only. Do NOT fix issues — only report them. The user decides what to do.
- Be specific: reference file paths and line numbers for every issue.
- A scenario without a step definition is always CRITICAL — the spec is not tested.
- A step definition with no assertions is always CRITICAL — it's a false positive.
- Don't verify implementation details — only verify that the behavior described in the scenario is covered.
- For baseline verification, this may take a while on large codebases. Present results incrementally by capability.
