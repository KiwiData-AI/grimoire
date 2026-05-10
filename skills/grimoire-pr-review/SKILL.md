---
name: grimoire-pr-review
description: Review a teammate's pull request using the shared multi-persona engine, against the actual PR diff. Fetches the PR, loads linked grimoire artifacts via the Change trailer, and produces structured findings suitable for PR comments.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.2"
---

# grimoire-pr-review

Review a pull request authored by someone else. Applies the shared persona engine in `../references/review-personas.md` to the real diff, cross-referenced with the PR's linked grimoire change (if any).

## Triggers
- User asks to review a teammate's PR / MR
- User supplies a PR number, URL, or branch and asks for review
- Loose match: "review this PR", "look at PR #123", "review <url>", "review teammate's branch", "code review"

## Routing
- Reviewing your own pre-merge change you just built → `grimoire-pr` (has optional post-impl review)
- Reviewing your own staged but uncommitted diff → `grimoire-precommit-review`
- Reviewing a design before any code exists → `grimoire-review`
- Verifying scenarios pass after merge → `grimoire-verify`
- Writing a bug report against merged behavior → `grimoire-bug-report`

## Prerequisites
- `gh` (GitHub) or `glab` (GitLab) CLI installed and authenticated, OR the PR's branch fetched locally
- Working directory is the repo the PR targets
- Optional: `.grimoire/` directory with baseline features/decisions for linked-change context

## Inputs
Accept any of:
- PR number: `123`
- PR URL: `https://github.com/org/repo/pull/123`
- Branch name: `feat/add-2fa-login`
- Base/head refs: `main...feat/add-2fa-login`

If nothing supplied, ask the user for one.

## Workflow

### 1. Fetch PR Metadata
Resolve the input to concrete refs.

- GitHub: `gh pr view <id> --json number,title,body,author,baseRefName,headRefName,files,commits,url`
- GitLab: `glab mr view <id> --output json`
- Branch only: derive base from default branch (`git remote show origin | grep 'HEAD branch'`) and head = supplied branch

Record: PR title, body, author, base branch, head branch, URL, file list, commit count.

### 2. Fetch the Diff
- GitHub: `gh pr diff <id>` (or `git fetch origin pull/<id>/head && git diff <base>...FETCH_HEAD`)
- GitLab: `glab mr diff <id>`
- Branch: `git fetch origin <head> && git diff origin/<base>...origin/<head>`

If the diff is very large (>2000 lines changed), ask the user whether to review the full diff, focus on a subset of files, or review commit-by-commit.

### 3. Find Linked Grimoire Change
Look for a `Change:` trailer in the PR commits:

```
git log <base>..<head> --format="%B" | grep -E "^Change:"
```

If present:
- Change ID = trailer value
- Load artifacts: first check `.grimoire/changes/<change-id>/` (in-progress), then `.grimoire/archive/*<change-id>*/` (archived). Try the PR's head branch checked out locally if needed.
- Read `manifest.md`, all `.feature` files in the change, decision records, `tasks.md`, `data.yml`
- Also grep for `Scenarios:` and `Decisions:` trailers to scope review to the named items

If no `Change:` trailer exists, that's itself a finding for a grimoire-managed repo: flag as **suggestion** ("commits missing audit trailer — `grimoire trace` won't find this PR") unless the project clearly doesn't use grimoire.

### 4. Gather Project Context
- `.grimoire/config.yaml` — language, tools, `commit_style`, `comment_style`, `project.compliance`, `dep_audit`
- `.grimoire/docs/context.yml` — deployment environment, related services
- `.grimoire/docs/data/schema.yml` — current data baseline
- Relevant `.grimoire/docs/<area>.md` for the directories touched by the diff

### 5. Build Project Briefing
Follow `../references/review-personas.md` §1 (Project Briefing) to construct the briefing block. Inject as preface to every persona run below.

### 6. Pick Personas — Diff Review Gating
Use the **Diff review** table in `../references/review-personas.md` §3 (Complexity Gating). Read `complexity` from the linked manifest if present; otherwise infer from diff size and touched areas. User can override ("full review", "just security", "just code style", etc.).

### 7. Run Personas
For each selected persona, follow its evaluation criteria in `../references/review-personas.md` §4 against the **PR diff** (with linked artifacts as cross-reference where relevant). Apply the materiality gate (§2) — every finding cites a briefing axis or feature-inventory gap, or is dropped.

Persona scope for PR review:
- 4.1 Product Manager — skip if pure internal refactor
- 4.2 Senior Engineer — always
- 4.3 Security Engineer — always; full STRIDE + code-level scan + compliance
- 4.4 QA Engineer — skip if pure internal
- 4.5 Data Engineer — skip if no migrations / models / schema / external API client touched
- 4.6 Code Style Reviewer — always

### 8. Present Findings
Compile into the standard report layout (§5 of the personas reference):

```markdown
# PR Review: <PR title> (#<number>)

**Author:** <author>  **Base:** <base>  **Head:** <head>
**Linked change:** <change-id or "none — missing Change: trailer">
**Complexity:** <1-4 or "inferred: moderate">
**Files changed:** <N>  **Lines:** +<add> / -<del>

## Project Briefing
<briefing block>

## Product Manager
- ...

## Senior Engineer
- ...

## Security Engineer
### STRIDE
- ...
### Findings
- ...

## QA Engineer
- ...

## Data Engineer
- ...

## Code Style
- ...

## Summary
- **N blockers** — must be addressed before merge
- **M suggestions** — consider addressing

Recommendation: Request changes / Approve.
```

### 9. Post to PR (optional)
Offer three modes:

- **Print only** (default) — just show the report
- **Post single review comment**:
  - GitHub: `gh pr review <id> --comment --body "<report>"` or `--request-changes` if there are blockers
  - GitLab: `glab mr note <id> --message "<report>"`
- **Post inline comments** — for each finding with a file:line, post a line comment:
  - GitHub: `gh api repos/<org>/<repo>/pulls/<id>/comments -f body=... -f path=... -f line=... -f commit_id=...`
  - This requires the commit SHA — get it from `gh pr view --json commits`

Ask the user which mode before posting. Never post without confirmation — PR comments are visible to the whole team.

### 10. Link Back
If a linked grimoire change was found and the review surfaced blockers that need spec changes (not just code changes), suggest the author run `grimoire-draft` or `grimoire-plan` on that change to update the artifacts before pushing fixes.

## Important
- This is a code review against a real diff — reference specific files and line numbers for every finding.
- Be direct. Don't pad with praise. Blockers stop the merge; suggestions are advisory.
- Respect the author. Findings describe the code, not the person.
- A PR without a `Change:` trailer in a grimoire repo is a soft finding, not a hard blocker.
- Don't re-derive tasks or specs. If the linked change's artifacts are wrong, that's a separate `grimoire-draft` / `grimoire-plan` cycle.
- If the diff is too large or too sprawling to review meaningfully, say so — offer to focus on a subset rather than producing a shallow full-pass review.
- Never post to the PR without explicit user confirmation.
- All persona evaluation criteria, the materiality gate, the briefing structure, and the complexity-depth table live in `../references/review-personas.md`. Don't duplicate them here — read that file when running a persona.

## Done
When the report is presented (and optionally posted), the workflow is complete. If blockers exist, suggest the author address them; if not, suggest approving via `gh pr review <id> --approve`.
