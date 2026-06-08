# Test Baseline Reference

Loaded by skills that mutate code (`grimoire-apply`, `grimoire-bug`, `grimoire-refactor`) and the skill that checks for regressions (`grimoire-verify`).

## Why

"That's a pre-existing failure" is unfalsifiable if you never recorded what was failing *before* you started. Without a baseline, verify diffs against nothing — a regression you introduced and a failure that was already red look identical, and the user finds out at the end instead of signing off at the start.

The fix is cheap: you already run the suite when you pick up a change. **Capture which tests were already failing, save it, and let the user accept it before any code is touched.** Verify then flags only *new* failures as regressions.

This is not a new gate. It's saving the result of a run you already do.

## Capture (at the start of a code change)

Do this once, before writing the first test or touching production code — as part of the suite run you'd do anyway to understand the starting state.

1. Run the configured suites: `config.tools.unit_test` and `config.tools.bdd_test`. Use what's configured; don't invent commands.
2. Record the result to `.grimoire/changes/<change-id>/baseline.md` (ephemeral scaffolding, discarded with the change folder like `tasks.md`). For a bug fix with no change folder, record inline in the commit/test note and present to the user instead.
3. Present the pre-existing failures to the user and get explicit acceptance before proceeding.

### baseline.md format

```markdown
# Test Baseline — <change-id>

captured: <date>          # the day you ran it; if unavailable, omit
unit:  <pass>/<total> passing   command: <config.tools.unit_test>
bdd:   <pass>/<total> passing   command: <config.tools.bdd_test>

## Pre-existing failures (accepted by user before change)
- <test id / name> — <one-line reason if known, else "pre-existing, cause unknown">
- ...

## Notes
- <e.g. "unit suite not configured — baseline skipped for unit">
```

If nothing was failing, say so explicitly: `## Pre-existing failures: none — clean baseline`.

## Skip rules

- **No test command configured** for a suite → skip that suite, write `baseline skipped — no <suite> command configured` under Notes. Don't fabricate a command.
- **User opts out** → write `baseline skipped — user opted out`. Verify must then NOT claim a clean diff; it reports failures as unclassified (could be pre-existing or new).
- A skipped baseline is recorded, not silent. Verify needs to know it can't trust a diff.

## Diff (at verify)

`grimoire-verify` reads `baseline.md` and classifies the current suite result against it:

- Test failing now **and** in baseline → **pre-existing** (already accepted; not a regression, don't blame the change).
- Test failing now, **not** in baseline → **regression** introduced by this change → CRITICAL, must fix before finalize.
- Test passing now, failing in baseline → incidentally fixed; note it, don't require it.
- **No baseline / baseline skipped** → state plainly that failures cannot be classified, and list them all for the user to triage. Do not assert "existing tests pass" or "pre-existing failure" without a baseline to back it.

The rule that replaces the old unfalsifiable claim: **a failure is "pre-existing" only if it's in `baseline.md`.** Otherwise it's yours.
