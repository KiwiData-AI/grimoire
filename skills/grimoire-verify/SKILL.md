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

4. **Report format:** Include test quality findings alongside correctness findings:
   ```
   - **[critical]** `test_auth.py:42` — step "Then I should be redirected" has no assertion (empty body)
   - **[warning]** `test_auth.py:58` — step "Then user should exist" only asserts `is not None` — check the actual user properties
   ```

If `grimoire test-quality` CLI command is available, suggest running it for a comprehensive analysis.

### 4. Security Compliance Verification

Verify that security guidance from the plan and review stages was actually followed in the implementation. This closes the gap between "advisory" and "enforced."

**A. Check plan-stage security patterns:**

The plan skill mandates proven patterns. Verify the implementation:
- **Authentication**: If the change touches auth, confirm it uses the framework's auth system or a proven library (passport, django.contrib.auth, next-auth) — not custom token generation or session management
- **Password hashing**: If passwords are stored, confirm bcrypt/argon2 — not MD5, SHA1, SHA256, or plaintext
- **SQL queries**: If the change touches database queries, confirm parameterized queries — not string concatenation or f-strings
- **CSRF**: If forms submit data, confirm CSRF protection is in place
- **Input validation**: Confirm user input is validated/sanitized at the boundary, not deep inside business logic
- **Secrets**: Confirm no hardcoded credentials, tokens, or keys — must come from environment or secret stores

**B. Check review findings were addressed:**

If a `grimoire-review` was run for this change (check git history or the change directory for a review artifact):
1. List each **blocker** from the Security Engineer review
2. For each blocker, search the implementation for evidence it was fixed
3. Flag any unaddressed blockers as CRITICAL

**C. OWASP Top 10 surface scan:**

For the changed files, do a lightweight scan against the OWASP Top 10:

| OWASP Category | What to check in the diff |
|---|---|
| A01: Broken Access Control | New endpoints missing auth decorators/middleware; direct object references without ownership checks |
| A02: Cryptographic Failures | Weak hashing, missing encryption for sensitive data at rest/transit, hardcoded keys |
| A03: Injection | String concatenation in SQL/commands/templates, eval(), innerHTML with user data |
| A04: Insecure Design | Missing rate limiting on auth endpoints, no account lockout, no anti-automation |
| A05: Security Misconfiguration | Debug mode enabled, default credentials, overly permissive CORS, verbose error responses |
| A06: Vulnerable Components | New dependencies without version pins, known-vulnerable package versions |
| A07: Auth Failures | Weak password requirements, missing MFA considerations, session tokens in URLs |
| A08: Data Integrity Failures | Insecure deserialization (pickle, yaml.load), missing integrity checks on updates |
| A09: Logging Failures | Security events not logged, PII/secrets in log output, no audit trail for admin actions |
| A10: SSRF | User-controlled URLs in server-side HTTP requests without allowlist validation |

Tag each finding with the OWASP category and CWE ID. Include in the report under a **Security** section:

```markdown
## Security Compliance
- Verified: parameterized queries used in `app/queries.py` (no SQL injection risk)
- Verified: bcrypt used for password hashing in `app/auth.py`
- **[critical]** [A01:2021 / CWE-862] `api/views.py:34` — new endpoint `/api/users/{id}/settings` has no permission check
- **[warning]** [A09:2021 / CWE-778] No audit logging for admin role changes in `admin/views.py:89`
```

**D. Verify security-tagged scenarios:**

Check feature files for security tags (`@security`, `@auth`, `@pii`, `@input-validation`, `@secrets`, `@pci-dss`, `@hipaa`, `@gdpr`, `@soc2`). For each tagged scenario:

- `@security` / `@auth` → Verify: auth checks present in implementation, negative test exists (unauthorized access returns 401/403)
- `@pii` → Verify: data encrypted at rest, access logged, no PII in log output
- `@input-validation` → Verify: validation at boundary, negative tests for malicious input exist
- `@secrets` → Verify: values come from env/secret store, no hardcoded credentials in source
- `@pci-dss` → Verify: no card data in logs, TLS for transmission, audit trail present
- `@hipaa` → Verify: access controls + audit logging, encryption at rest/transit
- `@gdpr` → Verify: consent mechanism if applicable, erasure support, data retention limits
- `@soc2` → Verify: audit logging, access controls, availability monitoring

A security-tagged scenario with no corresponding security verification in the tests is a **CRITICAL** issue.

If no security tags exist and the change has no security-relevant surface, state so briefly and move on.

### 5. Dead Feature Detection
Check for features that exist in specs but may no longer be implemented:
- Feature files with no corresponding step definitions anywhere
- Step definitions that import modules/functions that no longer exist
- Step definitions with `pass` or `NotImplementedError` bodies
- Features tagged `@skip` or `@wip` that have been in that state for a long time

### 6. Generate Report
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

### 7. Recommend Next Steps
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
