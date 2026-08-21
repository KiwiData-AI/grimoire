---
name: grimoire-pr
description: Finalize a grimoire change and create its PR — health check, decision statuses, deferral logging, change-folder removal, then description + `gh pr create`. Use whenever the user asks to create a PR and `.grimoire/changes/` is non-empty.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-pr

Finalize a grimoire change and create its pull request. This skill is the finalization gate: it runs the per-change health check, executes finalize if it has not happened yet, generates the PR description from the change artifacts, and creates the PR.

## Triggers
- User wants to create a PR for a completed grimoire change
- User asks to generate a PR description
- Loose match: "PR", "pull request", "ready to merge", "create PR"

## Routing
- Open tasks without an explicit deferral note → `grimoire-apply` first. The health check blocks the PR until every task is checked or explicitly deferred.
- Haven't committed yet → `grimoire-commit` first
- Want a pre-merge design review → this skill includes optional post-implementation review

## Prerequisites
- The change folder `.grimoire/changes/<change-id>/` exists
- `tasks.md` is complete, or every open task carries an explicit deferral note
- The work is committed on a feature branch; its diff vs. `main` is the change

## Workflow

### 1. Select Change
- List active changes in `.grimoire/changes/`
- If multiple, ask user which one to create a PR for
- If only one, confirm it

### 2. Gather Artifacts
Read all change artifacts:
- `manifest.md` — change summary, scope, and why
- `tasks.md` — implementation checklist (completion status + deferral notes)
- All `.feature` files touched by the change — scenario names for the test plan
- All decision records — ADR titles for the description
- Read `.grimoire/config.yaml` for commit style

### 3. Run the Health Check
Run the per-change checks in `../references/health-check.md` §A.
- **Blockers** → stop. Present them as a fix list; no PR until they pass.
- **Warnings** (e.g. `@not-implemented` tags) → collect them for the PR description.

### 4. Ensure Finalized
If the change folder is still present, the change is not finalized. Execute `grimoire-apply` §7 (Finalize) — that section is the definition of finalize; do not re-derive its steps here. One addition at PR time: open tasks carrying deferral notes are logged to the debt register (`.grimoire/docs/debt-register.yml`, format per `../references/refactor-register-format.md`) with `category: deferred-task` and the source change-id in `detail`, so deferred work survives the folder removal.

If the folder is already gone, finalize already ran — continue.

### 5. Generate PR Description
Run the CLI: `grimoire pr <change-id>` (add `--json` for structured output). It composes the title and body from the change artifacts — Summary, Changes, Scenarios, Decisions, Test Plan, task progress, and the `Change:` trailer. The CLI reads the change folder — capture its output before step 4's folder removal, then assemble the final body.

Append conditional sections the CLI does not generate:

**Security** — only if the change has security-tagged scenarios or touches security-relevant code:

```markdown
## Security
- Tags: `@security`, `@auth`, `@pii`, etc. (list all security tags from the feature files)
- Compliance: <list applicable frameworks from config, or "none configured">
- Security-tagged scenarios verified: X/Y
<if any security findings from review/verify exist, summarize the resolution>
```

**Deployment impact** — scan the change's `data.yml` and the migration in the diff for a table-locking ALTER, a NOT NULL on a large table, a rename/retype, or any backward-incompatible schema change. If present, include this section and lead the PR summary with the `⚠️` line — this is the merge-time visibility the Data Engineer review requires; surfacing it only in review is not enough. No such migration → omit the section entirely.

```markdown
## Deployment impact
- ⚠️ **Incurs downtime**: <which migration and why — e.g. "ALTER on `users` locks the table during the column rewrite">
- ⚠️ **Breaking schema change**: <backward-incompatible — old app versions break mid-deploy>
- Decision: <maintenance window accepted | split into expand→contract | rollout plan>
```

**Health warnings** — list the warnings collected in step 3 (e.g. `@not-implemented` scenarios with their tags).

#### Post-Implementation Review (Optional)
If the user wants a pre-merge review, **do NOT hand-roll a checklist** — apply the shared persona engine so self-review runs the *same rubrics as design review*: INVEST (PM), the YAGNI ladder + Rule of Three + Chesterton's Fence (Senior Engineer), STRIDE + LINDDUN + OWASP API Top 10 (Security), BVA/FIRST against the spec (QA), Expand–Contract + the deployment-impact flag (Data), then the Contrarian calibration pass.

1. Get the diff: `git diff <base>...HEAD`.
2. Apply `../references/review-personas.md` to that diff — same engine `grimoire-precommit-review` uses (it IS this review, pre-push). Run the **Diff review** path: build the Project Briefing (§1), pick personas via the diff-review complexity table (§3), apply the materiality / steel-man / severity gates (§2/§2a/§2b), then the Contrarian pass (§4.8). If the branch is already pushed, defer to `grimoire-pr-review` instead — identical engine, fuller PR metadata.
3. Present the engine's findings alongside the PR description. Blockers → fix before creating the PR (or open a draft). Carry any Data-persona downtime/breaking flag into the Deployment-impact section above.

One review engine, one set of rubrics — design and code alike. This skill no longer keeps a separate, lighter review prompt (DRY).

### 6. Create PR
Check that the branch is pushed to the remote before creating. If not, offer to push first.

- **Preview only** (default): output the PR title + assembled body for the user to copy
- **Create via CLI**: `grimoire pr <change-id> --create` (uses `gh` or `glab`)
- **Create with appendices**: if conditional sections were appended, pass the assembled body directly:
  ```
  gh pr create --title "<title>" --body "<body>"
  ```
  or for GitLab:
  ```
  glab mr create --title "<title>" --description "<body>"
  ```

Return the PR URL.

## Important
- Finalize has one definition — `grimoire-apply` §7. This skill executes it; it never redefines it.
- Open tasks block the PR unless each carries a deferral note; deferred tasks land in the debt register, never silently dropped.
- The PR description must trace back to grimoire artifacts — this is what makes the audit trail work.
- The `Change: <change-id>` line at the bottom lets `grimoire trace` find the PR; the CLI includes it.
- Don't pad the description with boilerplate. Keep it factual: what changed, why, how to verify.
- A downtime-incurring or backward-incompatible schema migration MUST carry a `⚠️` flag in the PR body (Deployment impact section) — never let it merge silently. Zero-downtime is not forced; *visibility* of the cost is.
- The post-implementation review is optional and quick — it's not a replacement for the design review, just a sanity check on the actual code.

## Done
When the PR is created (or the description presented for manual creation), the workflow is complete: decisions accepted, deferred tasks logged, change folder removed, description traced to the artifacts. Suggest merging the PR to complete the change — git history + the `Change:` trailer are the record; there is no separate archive step.
