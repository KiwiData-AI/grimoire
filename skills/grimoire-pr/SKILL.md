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

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with:
  - `manifest.md`
  - `tasks.md` with all (or most) tasks checked
  - Feature files and/or decision records
- The change should be on a feature branch (created during apply)

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

Change: <change-id>
```

**PR title:** Derive from manifest heading, following the project's commit style:
- conventional: `feat: add two-factor authentication`
- angular: `feat(auth): add two-factor authentication`

### 4. Post-Implementation Review (Optional)
If the user wants a review, run a quick automated pass on the actual diff:

1. Get the diff: `git diff main...HEAD` (or the base branch)
2. Read `.grimoire/config.yaml` for `project.compliance` and check feature files for security tags
3. Feed the diff + PR description to the LLM with this prompt:

> Review this pull request for issues that the design review might have missed now that real code exists. Focus on:
> - Implementation doesn't match the scenarios described
> - Missing error handling for edge cases in the scenarios
> - Dependencies added that weren't in the plan
> - Files changed that aren't covered by the task list (scope creep)
> - Test quality: are step definitions making real assertions?
>
> **Security review** — scan changed files per `../references/security-compliance.md`: OWASP surface scan, security tag verification, compliance verification. Tag findings with OWASP/CWE.
> Flag issues as **blocker** or **suggestion**. Be concise.

4. Present findings alongside the PR description.

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
- Update manifest's status to `complete` if not already
- Add the PR URL to the manifest as a comment or field
- Suggest running `grimoire archive <change-id>` to complete the lifecycle

## Important
- The PR description must trace back to grimoire artifacts — this is what makes the audit trail work.
- Include the `Change: <change-id>` line at the bottom so `grimoire trace` can find it.
- Don't pad the description with boilerplate. Keep it factual: what changed, why, how to verify.
- The post-implementation review is optional and quick — it's not a replacement for the design review, just a sanity check on the actual code.
- If tasks are incomplete, warn the user but don't block PR creation — they may want a draft PR.
