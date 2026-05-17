---
status: archived
complexity: medium
branch:
design_ref:
archived_on: 2026-05-17
---

# Change: Document 12 grimoire skills that ship without Gherkin specs

## Why
Twelve `skills/grimoire-*/SKILL.md` files describe their workflows but have no `.feature` baseline anywhere. Discovered during `grimoire-audit` on 2026-05-17. The skill markdown is implementation-leaning (instructions for AI); the feature files should describe what the skill must achieve from the user's perspective, so future skill edits can be reviewed against intent.

## Non-goals
- Not changing skill behavior.
- Not rewriting SKILL.md files.
- Not introducing tests that execute skills.
- Specs describe outcomes, not the prompt-engineering inside each SKILL.md.

## Feature Changes
- **ADDED** `onboarding/run-discover.feature` — `grimoire-discover` produces area docs, data schema (when applicable), and an index from a snapshot
- **ADDED** `onboarding/run-audit.feature` — `grimoire-audit` interviews the user to fill gaps in features and decisions
- **ADDED** `workflow/plan.feature` — `grimoire-plan` derives tasks from approved Gherkin + MADR
- **ADDED** `workflow/commit.feature` — `grimoire-commit` writes a contextual commit message with the change trailer
- **ADDED** `workflow/remove.feature` — `grimoire-remove` removes a feature or deprecates a decision through a tracked change
- **ADDED** `workflow/refactor.feature` — `grimoire-refactor` produces a prioritised tech-debt register
- **ADDED** `workflow/branch-guard.feature` — `grimoire-branch-guard` enforces branch hygiene before new-feature work
- **ADDED** `review/precommit-review.feature` — `grimoire-precommit-review` runs multi-persona review on local diff before commit
- **ADDED** `review/pr-review.feature` — `grimoire-pr-review` reviews a teammate's PR against linked grimoire artifacts
- **ADDED** `bug/fix.feature` — `grimoire-bug` enforces reproduce-first bug fixing
- **ADDED** `bug/report.feature` — `grimoire-bug-report` produces a reproducible bug report
- **ADDED** `bug/triage.feature` — `grimoire-bug-triage` classifies root cause and routes
- **ADDED** `bug/explore.feature` — `grimoire-bug-explore` runs gap-aware exploratory testing
- **ADDED** `bug/session.feature` — `grimoire-bug-session` runs a timeboxed exploratory session

## Scenarios Added
See each feature file for scenario list. Post-review additions (2026-05-17):
- `bug/report.feature` — report stays local unless MCP submission flow invoked
- `bug/explore.feature` — handoff offer to `/grimoire:draft` or `/grimoire:bug-report` after gap analysis
- `workflow/branch-guard.feature` — sanitisation of branch name passed to `git checkout -b`; hand-off to draft after branch switch; user-rejection path
- `workflow/commit.feature` — refuse to silently emit message lacking Change trailer
- `review/precommit-review.feature` — empty-diff exit path
- `review/pr-review.feature` — gh fetch failure error path

## Scenarios Modified
Post-review fixes (2026-05-17) to match actual skill behavior:
- `bug/session.feature` — output path corrected from `.grimoire/bugs/sessions/` to `.grimoire/sessions/<session-id>/{charter,notes,debrief}.md` (matches `skills/grimoire-bug-session/SKILL.md:60,122,153`); replaced invalid Gherkin `During the session` keyword
- `bug/report.feature` — output path corrected from `.grimoire/bugs/<slug>.md` to `.grimoire/bugs/<bug-id>/report.md` (matches `skills/grimoire-bug-report/SKILL.md:136`)
- `bug/explore.feature` — removed "records its run in `.grimoire/bugs/explore/`" scenario (skill produces inline output, no file write); split combined tester/developer-mode scenario into two
- `workflow/branch-guard.feature` — trimmed scenarios duplicated by `features/cli/branch-check.feature`; kept only skill-level behaviors (branch creation, handoff)
- `workflow/plan.feature` — Background no longer overstates MADR requirement
- `workflow/commit.feature` — subject limit tightened from "≤ 72" to "under 72" to match `skills/grimoire-commit/SKILL.md:62`
- `onboarding/run-audit.feature` — scope-arg scenario rewritten as interactive intake answer (skill has no CLI arg)

## Decisions
None created or superseded.
