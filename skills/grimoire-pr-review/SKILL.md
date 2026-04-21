---
name: grimoire-pr-review
description: Review a teammate's pull request using the same multi-persona lens as pre-commit review, but against the actual diff. Fetches the PR, loads linked grimoire artifacts via the Change trailer, and produces structured findings suitable for PR comments.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-pr-review

Review a pull request authored by someone else. Applies the same persona lens as `grimoire-review` (product, engineer, security, QA, data) to the real diff, cross-referenced with the PR's linked grimoire change (if any).

## Triggers
- User asks to review a teammate's PR / MR
- User supplies a PR number, URL, or branch and asks for review
- Loose match: "review this PR", "look at PR #123", "review <url>", "review teammate's branch", "code review"

## Routing
- Reviewing your own pre-merge change you just built → `grimoire-pr` (has optional post-impl review)
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
- `.grimoire/config.yaml` — language, tools, `commit_style`, `project.compliance`, `dep_audit`
- `.grimoire/docs/context.yml` — deployment environment, related services
- `.grimoire/docs/data/schema.yml` — current data baseline
- Relevant `.grimoire/docs/<area>.md` for the directories touched by the diff

### 5. Complexity-Gated Depth
Read `complexity` from the linked manifest frontmatter if available. Fall back to heuristics on the diff:

| Signal | Depth |
|---|---|
| Docs only, ≤50 lines | Senior engineer skim only |
| Linked manifest complexity 1-2, diff <200 lines, no security tags | Senior engineer + security quick scan |
| Linked manifest complexity 3, OR diff touches auth/data/API | All relevant personas (skip data if no schema change, skip QA if no user-facing change) |
| Linked manifest complexity 4, OR diff >500 lines, OR touches multiple domains | All personas mandatory |

User can override: "full review", "just security", "just engineer", etc.

### 6. Product Manager Review
*(Skip if PR is pure internal refactor with no user-facing change.)*

Evaluate against the linked feature files (if any) or the PR body:

- **Scenario coverage**: If a feature file exists in the change, does the diff implement every scenario? Any scenario with no matching code change?
- **Non-goals**: Does the diff touch anything the manifest's Non-goals section excludes?
- **Acceptance**: From the diff alone, could a PM validate this meets the feature's acceptance criteria?
- **Clarity**: Does the PR body (or linked manifest) make the user-visible outcome clear?

Flag as **blocker** or **suggestion**.

### 7. Senior Engineer Review
Review the actual code:

- **Simplicity**: Is this the simplest implementation? Any unnecessary abstraction, indirection, or config that could be inlined?
- **Conventions**: Does the new code match the file layout, naming, and patterns already in the touched areas? Check `.grimoire/docs/<area>.md` if present.
- **Reuse**: Are there existing utilities/functions that were re-implemented? `grep` for similar names or check the area doc's reusable-code list.
- **Dead code**: Functions added but not called, imports unused, commented-out code, stubs with no implementation.
- **Scope creep**: Files changed outside the scope implied by the change-id or manifest. Formatting-only changes to unrelated files = noise.
- **Error handling**: Are errors handled at boundaries? Internal code shouldn't be littered with defensive checks; external inputs must be validated.
- **Tests**: Do new behaviors have tests? Do the tests make real assertions (not just `assert true` / mock everything)? Check `../references/testing-contracts.md` if the framework matches.
- **Contract compatibility**: If `data.yml` / `schema.yml` exists, does the diff change request/response shape for a documented API? If yes, where's the contract test update?
- **Dependencies**: Any new packages in `package.json` / `requirements.txt` / `Cargo.toml` etc. not mentioned in tasks? Any version bumps that aren't noted?
- **Task alignment**: If `tasks.md` exists for the change, does the diff complete the tasks as written? Any task that was "done" but has no corresponding code?

Flag as **blocker** or **suggestion**.

### 8. Security Engineer Review
Apply `../references/security-compliance.md`.

#### 8a. STRIDE on the diff
For every new entry point, data flow, or trust boundary introduced by the diff:

| Threat | Question |
|---|---|
| **S**poofing | Auth check at every new route/handler? |
| **T**ampering | Input/message integrity validated? CSRF on state-changing requests? |
| **R**epudiation | Security-relevant actions logged? |
| **I**nfo disclosure | Error responses, logs, stack traces leaking PII/tokens/secrets? |
| **D**oS | Unbounded loops, unlimited file uploads, expensive queries on user input, no rate limit? |
| **E**oP | Role/permission checks at the right layer? Any bypass via missing middleware? |

Skip categories that don't apply.

#### 8b. Code-level scan
- **Secrets**: Grep the diff for hardcoded keys, tokens, passwords, cloud credentials, JWT secrets. Flag any hit as **blocker**.
- **Injection**: Raw SQL with string concatenation, shell-exec with user input, `eval`/`exec`, unsafe deserialization. Tag with OWASP + CWE.
- **Input validation**: New endpoints without schema validation, file uploads without size/type limits, path params used directly in filesystem calls (path traversal).
- **Auth**: New routes/handlers missing auth decorators / middleware. Compare against neighbors in the same file.
- **Dependencies**: New packages in lockfile — check the name is real (typosquat risk), check project's `dep_audit` tool output if committed. Flag packages with zero downloads or suspicious maintainers.
- **PII**: New logging statements that could emit PII; new storage of personal data without encryption.
- **Cross-service auth**: If `context.yml` lists related services, are service-to-service calls authenticated?

#### 8c. Compliance
If `project.compliance` configured, verify per `../references/security-compliance.md` section "Compliance Framework Verification". Any security-tagged scenario in the linked change with no corresponding verification in the diff = **blocker**.

#### 8d. Tag findings
Every security finding gets OWASP 2021 + CWE tags. See the CWE quick-reference in `../references/security-compliance.md`.

### 9. QA Engineer Review (optional)
Skip if PR is purely internal.

- **Test presence**: Every new user-facing behavior has a test? Every scenario from the linked feature file has step definitions?
- **Test quality**: Are tests asserting outputs, or just that code "ran"? Over-mocked tests are a red flag.
- **Negative paths**: For each happy path in the diff, is there a failure-path test?
- **Observability**: New feature — how will it be debugged in prod? Structured logs / metrics / error surfaces?
- **Regression risk**: Which existing tests cover the touched code? Were any tests removed or weakened in the diff?
- **Accessibility**: New UI — keyboard nav, aria labels, contrast?

### 10. Data Engineer Review (optional)
Skip unless diff touches migrations, models, schema files, or external API clients.

- **Migrations**: Safe to run on a live DB? Adding a NOT NULL without default on a large table = **blocker**. Renames without a two-step migration = **blocker**.
- **Indexes**: New foreign keys with no index? New query patterns against unindexed columns?
- **Naming**: New fields follow existing schema conventions?
- **Breaking contract**: Compare `data.yml` vs `schema.yml` — removed/renamed/retyped response fields or new required request fields = **blocker** unless a migration path is documented.
- **Transactions**: Multi-step writes wrapped in a transaction?

### 11. Present Findings
Compile into a single report structured for PR comments:

```markdown
# PR Review: <PR title> (#<number>)

**Author:** <author>  **Base:** <base>  **Head:** <head>
**Linked change:** <change-id or "none — missing Change: trailer">
**Complexity:** <1-4 or "inferred: moderate">
**Files changed:** <N>  **Lines:** +<add> / -<del>

## Product Manager
- **[blocker]** Scenario "Login with expired TOTP code" is in the feature file but no corresponding code path in `auth/verify.py`
- **[suggestion]** PR body doesn't mention the rate-limit change — add it

## Senior Engineer
- **[blocker]** `utils/hash_helpers.py` duplicates `security/crypto.py::hash_password` — reuse instead
- **[suggestion]** New abstraction `AuthProviderFactory` has one caller; inline it

## Security Engineer
### STRIDE
- Spoofing: N/A
- Tampering: new `/api/profile` PATCH has no CSRF token check
- Info disclosure: `logger.info(f"login attempt for {email}")` emits PII

### Findings
- **[blocker]** [A01:2021 / CWE-352] Missing CSRF check on `/api/profile` PATCH (`views/profile.py:42`)
- **[blocker]** [A09:2021 / CWE-532] Email logged in plaintext (`auth/login.py:88`)
- **[suggestion]** [A07:2021 / CWE-307] No rate limiting on login handler

## QA Engineer
- **[blocker]** New TOTP verification path has no test (`auth/totp.py:15-48`)
- **[suggestion]** Add negative test for malformed TOTP string

## Data Engineer
- **[blocker]** Migration `0042_add_2fa.py` adds NOT NULL `totp_secret` on existing `users` table — will fail on deploy
(or: "No schema changes — skipped.")

## Summary
- **5 blockers** — must be addressed before merge
- **3 suggestions** — consider addressing

Recommendation: Request changes.
```

### 12. Post to PR (optional)
Offer three modes:

- **Print only** (default) — just show the report
- **Post single review comment**:
  - GitHub: `gh pr review <id> --comment --body "<report>"` or `--request-changes` if there are blockers
  - GitLab: `glab mr note <id> --message "<report>"`
- **Post inline comments** — for each finding with a file:line, post a line comment:
  - GitHub: `gh api repos/<org>/<repo>/pulls/<id>/comments -f body=... -f path=... -f line=... -f commit_id=...`
  - This requires the commit SHA — get it from `gh pr view --json commits`

Ask the user which mode before posting. Never post without confirmation — PR comments are visible to the whole team.

### 13. Link Back
If a linked grimoire change was found and the review surfaced blockers that need spec changes (not just code changes), suggest the author run `grimoire-draft` or `grimoire-plan` on that change to update the artifacts before pushing fixes.

## Important
- This is a code review against a real diff — reference specific files and line numbers for every finding.
- Be direct. Don't pad with praise. Blockers are things that should stop the merge; suggestions are things the author should consider.
- Respect the author. Findings describe the code, not the person. "This query is vulnerable to injection" not "you wrote an injection".
- A PR without a `Change:` trailer in a grimoire repo is a soft finding, not a hard blocker — the team may have reasons.
- Don't re-derive tasks or specs. If the linked change's artifacts are wrong, that's a separate `grimoire-draft` / `grimoire-plan` cycle.
- If the diff is too large or too sprawling to review meaningfully, say so — offer to focus on a subset rather than producing a shallow full-pass review.
- Never post to the PR without explicit user confirmation.

## Done
When the report is presented (and optionally posted), the workflow is complete. If blockers exist, suggest the author address them; if not, suggest approving via `gh pr review <id> --approve`.
