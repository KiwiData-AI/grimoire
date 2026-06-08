# Skills
> Last updated: 2026-06-07

## Purpose
Claude Code skill definitions that provide grimoire's AI-driven workflow. Each skill is a `SKILL.md` file loaded as a slash command (e.g. `/grimoire:draft`). Skills are the primary interface between users and the grimoire workflow.

## Boundaries
- Skills are markdown instruction files, not code. They describe workflow steps for AI assistants and reference CLI commands (`grimoire validate`, `grimoire check`) without containing executable code.
- Skills are copied into a target project's `.claude/skills/` during `grimoire init` and `grimoire update` via `installSkillFiles()` in `src/core/shared-setup.ts` — the list there is authoritative. Register a new skill there.
- Long persona lists, rubrics, and format specs live in `skills/references/` (see `references.md`), not inline in each SKILL.md.

## Conventions

### Naming
- One directory per skill, `grimoire-<verb>/SKILL.md` — e.g. `skills/grimoire-draft/SKILL.md`. The slash-command name derives from the directory.

### Structure
- Every SKILL.md follows a consistent shape: title, triggers (when it activates), prerequisites (what must already exist), a numbered workflow, and an "Important"/constraints section. See `skills/grimoire-draft/SKILL.md` as an exemplar.
- Skills form a pipeline where each trusts the previous one's output: `branch-guard → draft → design-consult → design → plan → review → apply → verify → precommit-review → commit → pr → pr-review`. Onboarding (`grimoire-discover`, `grimoire-audit`), bug-handling (`grimoire-bug*`), and dependency (`grimoire-vuln-triage`, `grimoire-vuln-remediate`) skills sit alongside the main pipeline.
- Reference links use a relative path, e.g. `See ../references/review-personas.md`.

## Where New Code Goes
- New workflow skill → `skills/grimoire-<name>/SKILL.md`, then register it in `installSkillFiles()` (`src/core/shared-setup.ts`).
- Shared knowledge cited by 2+ skills → `skills/references/<name>.md` (see `references.md`).

## Structure (live)
For the full current inventory of skills and their cross-references, read the directory live:
- `skills/grimoire-*/SKILL.md` · `skills/references/*.md`
