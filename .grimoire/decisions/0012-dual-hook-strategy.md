---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Install both Claude Code hooks and git pre-commit hooks

## Context and Problem Statement
Grimoire needs to run `grimoire check` before commits and validate `Change:` trailers. Should it use Claude Code's hook system, git's native hooks, or both?

## Decision Drivers
- Must work for Claude Code users (primary audience)
- Must work for users committing via git CLI or other tools
- Should not require husky/lint-staged as a dependency
- Must validate grimoire-specific concerns (Change trailer, check pipeline)

## Considered Options
1. Dual hooks — install both `.claude/hooks.json` and `.git/hooks/pre-commit`
2. Git hooks only — `.git/hooks/pre-commit` covers all commit paths
3. Claude hooks only — `.claude/hooks.json` for Claude Code users
4. Husky/lint-staged — use the established JS ecosystem tool

## Decision Outcome
Chosen option: "Dual hooks", because Claude Code hooks provide richer integration (post-commit feedback, structured output) while git hooks catch commits from any tool. The git hook is a simple shell script that runs `grimoire check --changed`. The Claude hook adds Change trailer validation for active grimoire changes.

### Consequences
- Good: Covers both Claude Code and vanilla git commit paths
- Good: No external dependency (husky, lint-staged)
- Good: Claude hook can do grimoire-specific validation (trailers, active change context)
- Good: Git hook is a simple shell script — easy to inspect and modify
- Bad: Two hook mechanisms to maintain and keep in sync
- Bad: Git hook may conflict with existing pre-commit hooks (grimoire checks for existing hooks before overwriting)
- Bad: `.git/hooks/` is not tracked by git — lost on fresh clones (documented in init output)

### Confirmation
If commits via Claude Code trigger the Claude hook and commits via `git commit` trigger the git hook, both running `grimoire check`, the decision is validated.
