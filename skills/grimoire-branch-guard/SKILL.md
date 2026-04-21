---
name: grimoire-branch-guard
description: Enforce branch hygiene when starting a new feature. Use when the user requests a new feature and the current branch is dirty, mid-feature, or otherwise unfit for piggy-backing. Creates an appropriately named branch before any drafting or planning begins.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-branch-guard

Force a clean, appropriately named branch before a new feature is drafted. Prevents piggy-backing new scope onto an in-progress branch or dirty tree.

## Triggers
- User requests a new feature, capability, or behavior change
- The `grimoire branch-check` UserPromptSubmit hook emits a warning into the prompt context
- Before `grimoire-draft` runs for a *net-new* change (not an edit to an existing draft)
- User says: "new feature", "add feature", "build X", "implement X", "let's add", "i want to add"

## Routing
- Continuing an existing change (editing manifest, revising scenarios) → skip this skill; go straight to `grimoire-draft`
- Bug fix or refactor → skip; route to `grimoire-bug` or leave branch alone
- User is on `main`/`master`/`develop`/`trunk` with a clean tree → no hygiene issue; suggest a branch name but do not block
- User explicitly opts out ("stay on this branch", "piggy-back is fine") → respect it, but surface the risk once and record it in the manifest's Assumptions

## Preconditions
- Project is a git repository
- Current working directory is inside the project root (`.grimoire/` or `features/` discoverable upward)

## Workflow

### 1. Snapshot branch state
Run:

```
git branch --show-current
git status --porcelain
```

Then enumerate active grimoire changes:

```
grimoire list --changes --json
```

Record: current branch, dirty-file count, and any active change whose `manifest.md` frontmatter `branch:` matches the current branch.

### 2. Classify the situation

| Condition | Action |
|-----------|--------|
| Clean tree + on protected branch (main/master/develop/trunk) | Propose a new branch name, create it, proceed |
| Clean tree + on feature branch tied to a matching active change | **Block.** This branch belongs to an existing change. Ask: is the request related to that change (edit) or truly new (branch)? |
| Clean tree + on feature branch with **no** matching active change | Warn that the branch appears stale. Offer: rebase onto main, or create a new branch |
| Dirty tree (any branch) | **Block.** Require the user to commit, stash, or discard before proceeding |
| Dirty tree + active change on this branch | **Block hard.** Finish the in-progress change (or commit WIP) before drafting a new one |

### 3. Propose a branch name
Derive a slug from the user's request. Use the `feat/` prefix for features, `chore/` for chores, `refactor/` for refactors. Examples:

- "Add password reset flow" → `feat/password-reset`
- "Let's build a CSV export" → `feat/csv-export`
- "I want to add rate limiting to the API" → `feat/api-rate-limiting`

Keep slugs short (≤40 chars), lowercase, hyphen-separated. Prefer nouns from the request. Avoid including the verb ("add", "new") in the slug.

Confirm the name with the user before creating the branch.

### 4. Create the branch

If dirty, first help the user resolve:

- **Commit WIP**: `git commit -am "wip: <summary>"` (only if changes belong to the current feature)
- **Stash**: `git stash push -m "wip before <new-feature-slug>"`
- **Discard**: only if user explicitly says so

Then create and switch:

```
git switch -c <proposed-slug>
```

Or, if starting from something other than the default branch:

```
git switch main && git pull --ff-only && git switch -c <proposed-slug>
```

### 5. Hand off to `grimoire-draft`
Once on the new branch with a clean tree, invoke `grimoire-draft`. In the draft's `manifest.md`, set the `branch:` frontmatter field to the new branch name so future prompts can match.

## Do-not
- **Do not** draft, plan, or edit specs while the branch guard is active and the conditions above are not met.
- **Do not** silently create a branch without confirming the name with the user.
- **Do not** force-delete uncommitted work. When in doubt, stash.
- **Do not** piggy-back features onto a branch whose manifest describes a different change. This violates grimoire's one-branch-one-change assumption and breaks the `Change:` trailer audit trail.
- **Do not** override the guard for a single clarifying exchange (e.g., "what's the schema for X?" is not a new-feature request).

## Configuration
- Intent patterns live in `src/core/branch-check.ts` (`NEW_FEATURE_PATTERNS`). If the hook is over- or under-triggering, adjust there.
- Protected branches: `main`, `master`, `develop`, `trunk`. Add project-specific defaults in `.grimoire/config.yaml` under `project.protected_branches` (if/when implemented).

## Rationale
A branch that bundles two features makes every downstream grimoire artifact ambiguous:

- The `Change:` commit trailer points at one change, not both
- `manifest.md` frontmatter has one `branch:` field, so only one change can claim it
- `grimoire check --changed` cannot tell which scenarios back which code
- PR review (`grimoire-pr-review`) cannot isolate the diff for a single change

Forcing a dedicated branch up front is cheaper than untangling a mixed branch later.
