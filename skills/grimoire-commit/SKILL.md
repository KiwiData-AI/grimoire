---
name: grimoire-commit
description: Write a contextual commit message from staged changes and active grimoire change context. Use when the user asks to commit or after completing a task.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-commit

Write a commit message from staged changes and active grimoire context. Never auto-commit — always present for approval.

## Triggers
- User asks to commit, write a commit message, or prepare a commit
- User asks to stage and commit changes
- Loose match: "commit", "commit message", "stage", "save progress"

## Routing
- No changes to commit → nothing to do
- Want to create a PR → `grimoire-pr` (commit first, then PR)
- Want to review changes before committing → show the diff first

## Workflow

### 1. Gather Context
- Run `git diff --cached` to read staged changes (if nothing staged, check `git diff` for unstaged changes and ask if user wants to stage)
- Read `.grimoire/config.yaml` to get `commit_style` setting
- Find active grimoire change: scan `.grimoire/changes/*/manifest.md`
- Read `tasks.md` from the active change if it exists — note which tasks are being completed
- Note any modified `.feature` files or decision records

### 2. Analyze Changes
From the diff, determine:
- **Type**: feat, fix, refactor, docs, test, chore, build, ci, style, perf
- **Scope**: infer from the directories/modules changed (e.g., auth, api, models)
- **Summary**: what changed and why
- **Grimoire context**: which change ID, which scenarios affected, which decisions

### 3. Generate Commit Message

**Conventional commits (default):**
```
<type>(<scope>): <short description>

<body — what changed and why, referencing grimoire context>

Change: <change-id>
Scenarios: <affected scenario names>
Decisions: <affected ADR numbers>
```

**Angular style:**
Same structure as conventional commits with stricter type enforcement:
- feat, fix, docs, style, refactor, perf, test, build, ci, chore

**Custom:**
If `commit_style` in config is anything else, read it as a format hint and adapt.

### 4. Quality Rules
- First line under 72 characters
- Body explains WHY, not just WHAT (the diff shows what)
- Use imperative mood ("add", "fix", "update" — not "added", "fixes", "updated")
- Don't include file lists in the commit message — `git log --stat` shows that
- If multiple logical changes are staged, suggest splitting into separate commits

### 5. Git Trailers (mandatory for audit trail)
When a grimoire change is active, the commit **MUST** include `Change:` as a git trailer. This is what makes `grimoire trace` and `grimoire log` work — without it, the commit is invisible to the audit trail.

```
Change: add-2fa-login
Scenarios: "Login with valid TOTP code", "Login with expired TOTP code"
Decisions: 0003-totp-library
```

- `Change:` is **required** when committing during an active grimoire change
- `Scenarios:` and `Decisions:` are included when relevant
- These are standard git trailers (parsed by `git log --format="%(trailers)"`)
- The bug skill should also include `Change:` if a scenario was added to cover a spec gap
- Commits outside grimoire changes (config, deps, formatting) don't need trailers

### 6. Branch Naming
If no branch exists for the change yet, suggest creating one before committing:

```
<type>/<change-id>
```

Where `<type>` matches the commit type:
- `feat/add-2fa-login` — new feature
- `fix/handle-null-pricing` — bug fix
- `refactor/migrate-to-sqlalchemy` — refactoring
- `chore/update-dependencies` — maintenance

The branch name links the git history to the grimoire change. Create the branch before the first commit for a change:
```
git checkout -b feat/<change-id>
```

### 7. Present to User
Show the proposed commit message and offer:
- **Accept** — run `git commit` with the message
- **Edit** — user modifies the message, then commit
- **Cancel** — abort, nothing happens

If the user accepts, execute:
```
git commit -m "<message>"
```

## Examples

**Feature implementation (with grimoire context):**
```
feat(auth): add TOTP verification for two-factor login

Implement TOTP code verification using pyotp. Step definitions
cover both valid and expired code scenarios.

Change: add-2fa-login
Scenarios: "Login with valid TOTP code", "Login with expired TOTP code"
```

**Bug fix (no grimoire context):**
```
fix(api): handle null response from external pricing service

The pricing API occasionally returns null for discontinued items.
Added null check before accessing price field.
```

**Refactoring (with decision reference):**
```
refactor(db): migrate from raw SQL to SQLAlchemy ORM

Follows decision in 0005-adopt-sqlalchemy.md. Converts all
direct SQL queries in the reporting module to ORM equivalents.

Decisions: 0005-adopt-sqlalchemy
```

## Important
- **Never auto-commit.** Always present the message for approval first.
- If no grimoire change is active, still write a good commit message from the diff alone.
- If the diff is too large to summarize meaningfully, suggest the user split it into smaller commits.
- The grimoire footer (Change/Scenarios/Decisions) is only included when an active grimoire change exists and is relevant to the staged changes.
- Respect the project's configured `commit_style` from `.grimoire/config.yaml`.

## Done
When the commit is created (or the user cancels), the workflow is complete. If this was the last commit for a change, suggest `grimoire-pr` to create a pull request.
