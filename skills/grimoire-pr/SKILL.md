---
name: grimoire-pr
description: Finalize a grimoire change when needed, then create its PR from Git history and changed live artifacts. Use whenever the user asks to create a PR for a grimoire change.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-pr

Finalize a grimoire change and create its pull request. This skill is the
finalization gate: it executes apply finalization when needed, runs the
post-cleanup health gate, generates the description from Git and live artifacts,
and creates the PR.

## Triggers
- User wants to create a PR for a completed grimoire change
- User asks to generate a PR description
- Loose match: "PR", "pull request", "ready to merge", "create PR"

## Routing
- Open tasks without an explicit deferral note → `grimoire-apply` first. The health check blocks the PR until every task is checked or explicitly deferred.
- Implementation has not completed Verify → `grimoire-verify` first

## Prerequisites
- The work is on a feature branch.
- The change is identifiable from an active change folder or branch `Change:`
  trailers.

## Workflow

### 1. Select Change
- List active change folders and change IDs in branch commit trailers.
- Accept branches containing multiple related change IDs when every branch commit
  has at least one `Change:` line. If multiple IDs are candidates, require the
  user to select the PR change ID explicitly.
- Retain the selected change ID after cleanup.

### 2. Ensure Finalized
Finalization is defined only by `grimoire-apply` §7.

If the selected change folder exists, execute `grimoire-apply` §7. Apply owns
health checks, durable updates, cleanup, documentation regeneration, staging,
the one final staged review, and the immediate final commit.

If the folder is already gone, inspect the selected change's final commit. It
must contain both `Change: <change-id>` and
`Final-production-review: approved`. Stop if either trailer is absent. Do not
route to another production review.

### 3. Run the Health Check
After cleanup and the final commit, run the post-cleanup and finalized-change
checks in `../references/health-check.md` §A from Git history and changed live
artifacts.
- **Blockers** → stop. Present them as a fix list; no PR until they pass.
- **Warnings** (e.g. `@not-implemented` tags) → collect them for the PR description.

### 4. Generate PR Description
Run `grimoire pr <change-id>` after cleanup. It derives the title, summary,
scenarios, decisions, test plan, and trace footer from branch commits, trailers,
and changed live features and decisions.

Append conditional sections the CLI does not generate:

**Security** — only if the change has security-tagged scenarios or touches security-relevant code:

```markdown
## Security
- Tags: `@security`, `@auth`, `@pii`, etc. (list all security tags from the feature files)
- Compliance: <list applicable frameworks from config, or "none configured">
- Security-tagged scenarios verified: X/Y
<if any security findings from review/verify exist, summarize the resolution>
```

**Deployment impact** — scan the schema and migration diff for a table-locking
ALTER, a NOT NULL on a large table, a rename/retype, or another
backward-incompatible schema change. If present, include this section and lead
the PR summary with the `⚠️` line. No such migration means omit the section.

```markdown
## Deployment impact
- ⚠️ **Incurs downtime**: <which migration and why — e.g. "ALTER on `users` locks the table during the column rewrite">
- ⚠️ **Breaking schema change**: <backward-incompatible — old app versions break mid-deploy>
- Decision: <maintenance window accepted | split into expand→contract | rollout plan>
```

**Health warnings** — list the warnings collected in step 3 (e.g. `@not-implemented` scenarios with their tags).

### 5. Create PR
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
- Finalize has one definition: `grimoire-apply` §7. This skill executes it and
  never redefines it.
- Open tasks block the PR unless each carries a deferral note; deferred tasks land in the debt register, never silently dropped.
- Generate the PR description only after cleanup from Git history and changed
  live artifacts.
- Multiple related change IDs may share a branch. Explicit change selection
  determines PR identity and description content.
- The `Change: <change-id>` line at the bottom lets `grimoire trace` find the PR; the CLI includes it.
- Don't pad the description with boilerplate. Keep it factual: what changed, why, how to verify.
- A downtime-incurring or backward-incompatible schema migration MUST carry a `⚠️` flag in the PR body (Deployment impact section) — never let it merge silently. Zero-downtime is not forced; *visibility* of the cost is.

## Done
When the PR is created (or the description presented for manual creation), the workflow is complete: decisions accepted, deferred tasks logged, change folder removed, description traced to the artifacts. Suggest merging the PR to complete the change — git history + the `Change:` trailer are the record; there is no separate archive step.
