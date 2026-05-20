---
name: grimoire-bug
description: Disciplined bug fix workflow with reproduction-first methodology. Use when the user reports a bug or defect that needs fixing.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug

Disciplined bug fix workflow: reproduce first, then fix. Every bug gets a failing test before any code changes.

## Triggers
- User reports a bug, defect, or unexpected behavior
- User says something is "broken", "wrong", "not working"
- Loose match: "bug", "fix", "broken", "defect", "issue", "regression"

## Routing
- Tester/non-developer reporting a bug → `grimoire-bug-report`
- Feature request disguised as a bug → `grimoire-draft`
- Performance issue → handle directly (profiling, not repro test)
- Configuration error → just fix the config

## Workflow

### 1. Understand the Bug
Get enough information to reproduce:
- **What happened** — the actual behavior
- **What should happen** — the expected behavior
- **How to trigger it** — steps to reproduce

If the user's report is vague, ask one clarifying question. Don't start fixing until you can describe the reproduction steps.

### 2. Classify the Bug

**Check existing feature files** — `grep -rn '<keyword from bug>' features/` to find scenarios describing the expected behavior.

**Scenario exists** → The spec is right, the code is wrong. This is a pure implementation bug. Skip to step 3.

**No scenario covers this behavior** → The bug reveals a gap in the specs. This is a missing scenario. Before fixing:
1. Write a new scenario (or add to an existing feature) that describes the correct behavior
2. Add it directly to `features/` (not through a full grimoire change — this is a gap fill, not new functionality)
3. Note in a comment or commit message that this scenario was added to cover a discovered bug

**Scenario is wrong** → Rare, but possible. The spec itself describes incorrect behavior. Flag this to the user — it may need a grimoire draft to update the feature properly.

### 3. Write a Reproduction Test
Before touching any production code:

1. Write a step definition (or unit test if no BDD scenario applies) that exercises the exact bug conditions
2. Run it — **it MUST FAIL**, reproducing the bug
3. If it passes, your test doesn't actually reproduce the bug. Fix the test until it fails for the right reason.

This is non-negotiable. A bug fix without a reproduction test is a guess that might work. A failing test is proof you understand the problem.

### 4. Document the Bug
Create a brief record in the test or commit. No separate tracking file needed — the test IS the documentation.

The reproduction test should make the bug obvious:
```gherkin
# Bug: users with special characters in email can't reset password
Scenario: Password reset with plus-sign email
  Given a user exists with email "test+alias@example.com"
  When they request a password reset
  Then they should receive a reset email
```

Or as a unit test comment:
```python
def test_password_reset_special_chars():
    """Bug: email addresses with + were being URL-encoded in the reset
    link, causing lookup failures. Reported 2026-04-05."""
```

The commit message should reference the bug:
```
fix(auth): handle special characters in password reset emails

Plus signs in email addresses were URL-encoded during reset link
generation, causing user lookup to fail on the reset page.

Added scenario: "Password reset with plus-sign email"
```

### 5. Decide the Branch

Default bias: **stay on the current branch if the bug is related to in-flight work.** Only create a new branch when the bug is clearly a separate concern from whatever the current branch is doing.

Snapshot state first:

```
git branch --show-current
git status --porcelain
grimoire list --changes --json
```

Find any active change whose `manifest.md` `branch:` matches the current branch.

| Current state | Bug relation | Action |
|---------------|--------------|--------|
| Protected branch (`main`/`master`/`develop`/`trunk`), clean tree | any | Create `fix/<short-description>` and switch |
| Feature branch + active change on it | Bug is in the same feature/code path the change touches | **Stay on the branch.** Fix in place. The repro test and fix become part of that change |
| Feature branch + active change on it | Bug is unrelated to that change | Ask the user. Default: stash/commit, switch to default branch, create `fix/...` off it |
| Feature branch + no matching active change | any | Create `fix/<short-description>` off the default branch |
| Dirty tree, no clear owner | any | Block. Commit, stash, or discard before proceeding |

How to judge "related vs separate":
- **Related** — the bug lives in files the in-flight change is modifying, or the bug is a direct consequence of the in-flight work (e.g. tests added by the change reveal it, the new code path crashes on an edge case). Fixing it on the same branch keeps the change coherent and the PR self-contained.
- **Separate** — the bug exists on `main` independent of the in-flight change, touches unrelated code, or would still need to ship if the in-flight change were abandoned. Mixing it in pollutes the diff and the `Change:` trailer.

When in doubt, ask the user one question: "This bug looks like it's [in / outside] the scope of the current `<branch>` work — fix it here, or branch off main?"

Branch name format when creating new: `fix/<short-description>` (e.g. `fix/special-chars-password-reset`, `fix/null-pricing-response`).

### 6. Fix the Bug
Now — and only now — modify production code. **Apply `../references/code-quality.md` while writing the fix, not after.** Inline rules:
- Reuse existing utilities — grep / check the area doc before adding new helpers.
- No new defensive guards inside the trust boundary — fix the real bug, don't paper over it with `if x is None` / `try-except`.
- Specific names — no `data` / `result` / `temp` when a concrete name fits.
- No new abstraction layer for a one-line bug fix.
- Comments only for non-obvious *why* — one short note linking the bug + reproduction test is enough.

Then:

1. Make the smallest change that fixes the failing test
2. **Hallucination check:** Before running tests, verify every external function/method the fix calls actually exists: `search_graph(name_pattern="<name>")` for each new call. If not found: locate the correct function or stop and flag to user. (Full instructions in `../references/pattern-guard.md` Step 6. Skip if graph not indexed.)
3. Run the reproduction test — it should pass
4. Run ALL existing tests — no regressions
5. If the fix is more than a few lines, pause and consider whether the approach is the simplest one
6. **Code quality check:** Walk the seven-point checklist in `../references/code-quality.md` against every file you changed. Any fail → fix and re-run tests.

**Escalation guard:** If the fix requires changes to more than 3 files, introduces new abstractions, modifies data models, or crosses service boundaries — STOP. This is not a bug fix, it's a change that needs design. Tell the user: "This fix is larger than a typical bug fix. I recommend routing to `grimoire-draft` to handle this as a proper change with specs and a plan." The user can override.

### 7. Verify
- Reproduction test passes (`config.tools.bdd_test`)
- All existing feature scenarios pass (`config.tools.bdd_test`)
- All existing unit/integration tests pass (`config.tools.unit_test`)
- If a new scenario was added in step 2, it passes with the fix

### 8. Tester Verification Checklist

After the fix, generate a checklist for testers to verify the fix and check for regressions. This bridges the gap between "developer says it's fixed" and "tester confirms it's fixed."

1. **Confirm the original bug** — restate the exact reproduction steps from the report and what the tester should now see instead.

2. **Check related areas** — identify 3-5 areas that could have been affected by the fix:
   - Other scenarios in the same feature file
   - Features that share the same code path or data (check what the fix touched)
   - Edge cases near the fix — if you fixed a null check, what about empty strings? If you fixed one role, what about other roles?

3. **Generate the checklist:**
```markdown
## Verification Checklist: <bug-id>
Branch: `<current-branch>` (new `fix/...` branch, or the in-flight feature branch if fixed in place)

### Original Bug
- [ ] Reproduce the original steps: <steps>
- [ ] Confirm expected behavior: <what should happen now>

### Regression Checks
- [ ] <related scenario or area>: <what to verify>
- [ ] <related scenario or area>: <what to verify>
- [ ] <related scenario or area>: <what to verify>
```

4. **Include in bug report** — append the checklist to `.grimoire/bugs/<bug-id>/report.md` (or the triage file if it exists) so the tester can find it.

5. If an external ticket exists, post the checklist as a comment so the tester doesn't need to look at local files.

### 9. Summary
Report to the user:
- What the bug was (root cause, not symptoms)
- What was changed (files and what specifically)
- Whether a new scenario was added to cover the gap
- Test results
- The verification checklist for testers (from step 8)

## When NOT to Use This Skill
- **Feature requests disguised as bugs** — "it's broken because it doesn't do X" when X was never specified. Route to `grimoire-draft`.
- **Performance issues** — these usually need profiling, not a repro test. Handle directly.
- **Configuration errors** — wrong env vars, missing dependencies, bad setup. Just fix the config.

## References

**Before writing the fix**, read both:
- `../references/code-quality.md` — anti-slop rules to apply *while writing*: reuse before write, trust callers, names reveal intent, branching budget, function size, no premature abstraction, comments only for non-obvious why. Includes a seven-point quality gate to run before declaring the fix done.
- `../references/pattern-guard.md` Step 6 only — after writing the fix, verify every new external function call exists in the graph via `search_graph`. Skip the full pattern brief (over-constrains bug fixes). Skip entirely if graph not indexed.

## Important
- **Reproduce before you fix.** No exceptions. If you can't reproduce it, you don't understand it, and your fix is a guess.
- **Small fixes only.** If the bug fix requires significant architectural changes, it's not a bug fix — route to `grimoire-draft` for a proper change.
- **Don't over-document.** The test is the documentation. A one-line comment in the test explaining the bug is enough. Don't create tracking files, bug reports, or manifests for a bug fix.
- **The feature file is truth.** If a scenario describes behavior the user now says is wrong, that's a spec change, not a bug. Handle it through `grimoire-draft`.
- **One bug, one fix.** Don't bundle "while I'm in here" improvements with a bug fix. Fix the bug, nothing more.
- **Don't reflexively branch.** A bug related to in-flight work belongs on the in-flight branch — splitting it into a separate PR fragments the change and breaks the `Change:` trailer audit trail. Branch only when the bug is genuinely a separate concern. See step 5.

## Done
When the bug is fixed, tests pass (reproduction + regression), and the summary is presented, the workflow is complete. Suggest `grimoire-commit` for the fix commit.
