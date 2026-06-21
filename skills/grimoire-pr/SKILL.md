---
name: grimoire-pr
description: Generate a pull request description from grimoire change artifacts with optional post-implementation LLM review. Use when the user is ready to create a PR.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-pr

Generate a pull request description from grimoire change artifacts and optionally run a post-implementation review.

## Triggers
- User wants to create a PR for a completed grimoire change
- User asks to generate a PR description
- Loose match: "PR", "pull request", "ready to merge", "create PR"

## Routing
- Tasks incomplete or finalize not done → `grimoire-apply` first. Do not create a PR before the change is finalized — the PR reflects the finished branch state (decisions accepted, change folder removed).
- Haven't committed yet → `grimoire-commit` first
- Want a pre-merge design review → this skill includes optional post-implementation review

## Prerequisites
- Change has been finalized: `.grimoire/changes/<change-id>/` is removed (manifest/tasks were ephemeral scaffolding)
- Decision records are live in `.grimoire/decisions/` with status `accepted`
- The change is on a feature branch (created during draft/apply); its diff vs. `main` is the change

## Workflow

### 1. Select Change
- List active changes in `.grimoire/changes/`
- If multiple, ask user which one to create a PR for
- If only one, confirm it

### 2. Gather Artifacts
Read all change artifacts:
- `manifest.md` — change summary, scope, and why
- `tasks.md` — implementation checklist (check completion status)
- All `.feature` files — scenario names for the test plan
- All decision records — ADR titles for the description
- Read `.grimoire/config.yaml` for commit style

### 3. Generate PR Description
Compose the PR body from grimoire artifacts:

```markdown
## Summary
<from manifest's "Why" section — 1-3 sentences>

## Changes
<from manifest's "Feature Changes" section>
- **ADDED** `capability/name.feature` — description
- **MODIFIED** `capability/name.feature` — what changed

## Scenarios
<list all scenario names from the feature files>
- "Scenario name" (`feature/file.feature`)
- "Scenario name" (`feature/file.feature`)

## Decisions
<list ADR titles, or "None" if no architectural decisions>
- 0005: Use PostgreSQL for vector storage

## Test Plan
- [ ] All new feature scenarios pass
- [ ] No regressions in existing tests
- [ ] ADR confirmation criteria met (if applicable)
<additional items from tasks.md verification section>

## Security
<only include this section if the change has security-tagged scenarios or touches security-relevant code>
- Tags: `@security`, `@auth`, `@pii`, etc. (list all security tags from the feature files)
- Compliance: <list applicable frameworks from config, or "none configured">
- Security-tagged scenarios verified: X/Y
<if any security findings from review/verify exist, summarize the resolution>

## Deployment impact
<only include if the change has a downtime-incurring or backward-incompatible schema migration (per the Data Engineer persona, `../references/review-personas.md` §4.5)>
- ⚠️ **Incurs downtime**: <which migration and why — e.g. "ALTER on `users` locks the table during the column rewrite">
- ⚠️ **Breaking schema change**: <backward-incompatible — old app versions break mid-deploy>
- Decision: <maintenance window accepted | split into expand→contract | rollout plan>

Change: <change-id>
```

**Deployment impact (when to include):** Scan `.grimoire/changes/<id>/data.yml` and the migration in the diff for a table-locking ALTER, a NOT NULL on a large table, a rename/retype, or any backward-incompatible schema change. If present, include the **Deployment impact** section and lead the PR summary with the `⚠️` line — this is the merge-time visibility the Data Engineer review requires; surfacing it only in review is not enough. No such migration → omit the section entirely.

**PR title:** Derive from manifest heading, following the project's commit style:
- conventional: `feat: add two-factor authentication`
- angular: `feat(auth): add two-factor authentication`

### 4. Post-Implementation Review (Optional)
If the user wants a pre-merge review, **do NOT hand-roll a checklist** — apply the shared persona engine so self-review runs the *same rubrics as design review*: INVEST (PM), the YAGNI ladder + Rule of Three + Chesterton's Fence (Senior Engineer), STRIDE + LINDDUN + OWASP API Top 10 (Security), BVA/FIRST against the spec (QA), Expand–Contract + the deployment-impact flag (Data), then the Contrarian calibration pass.

1. Get the diff: `git diff <base>...HEAD`.
2. Apply `../references/review-personas.md` to that diff — same engine `grimoire-precommit-review` uses (it IS this review, pre-push). Run the **Diff review** path: build the Project Briefing (§1), pick personas via the diff-review complexity table (§3), apply the materiality / steel-man / severity gates (§2/§2a/§2b), then the Contrarian pass (§4.8). If the branch is already pushed, defer to `grimoire-pr-review` instead — identical engine, fuller PR metadata.
3. Present the engine's findings alongside the PR description. Blockers → fix before creating the PR (or open a draft). Carry any Data-persona downtime/breaking flag into the Deployment-impact section above.

One review engine, one set of rubrics — design and code alike. This skill no longer keeps a separate, lighter review prompt (DRY).

### 5. Create PR
Offer to create the PR:
- **Preview only** (default): Output the PR title + body for the user to copy
- **Create via gh**: If the user confirms and `gh` is available, run:
  ```
  gh pr create --title "<title>" --body "<body>"
  ```
- **Create via glab**: If the project uses GitLab and `glab` is available:
  ```
  glab mr create --title "<title>" --description "<body>"
  ```

Check that the branch is pushed to the remote before creating. If not, offer to push first.

### 6. Link Back
After PR creation:
- The `Change: <change-id>` trailer on the commits links them to the change; the PR body + git log are the durable record (the change folder was already removed at finalize).
- Suggest merging the PR to complete the change. There is no archive step — git history is the history.

## Important
- The PR description must trace back to grimoire artifacts — this is what makes the audit trail work.
- Include the `Change: <change-id>` line at the bottom so `grimoire trace` can find it.
- Don't pad the description with boilerplate. Keep it factual: what changed, why, how to verify.
- A downtime-incurring or backward-incompatible schema migration MUST carry a `⚠️` flag in the PR body (Deployment impact section) — never let it merge silently. Zero-downtime is not forced; *visibility* of the cost is.
- The post-implementation review is optional and quick — it's not a replacement for the design review, just a sanity check on the actual code.
- If tasks are incomplete, warn the user but don't block PR creation — they may want a draft PR.

## Done
When the PR is created (or description is presented for manual creation), the workflow is complete. Suggest merging the PR to complete the change — git history + the `Change:` trailer are the record; there is no separate archive step.
