# Skills
> Last updated: 2026-09-03

## Purpose
Markdown skill definitions that provide Grimoire's AI-driven workflow. Skills are the primary interface between users and the Grimoire workflow.

## Boundaries
- Skills are markdown instruction files, not code. They describe workflow steps for AI assistants and reference CLI commands (`grimoire validate`, `grimoire check`) without containing executable code.
- Skills are copied into the configured Claude, OpenCode, or Codex skill directory during `grimoire init` and `grimoire update` via `installSkillFiles()` in `src/core/shared-setup.ts` — the agent and skill lists there are authoritative.
- Long persona lists, rubrics, and format specs live in `skills/references/` (see `references.md`), not inline in each SKILL.md.

## Conventions

### Naming
- One directory per skill, `grimoire-<verb>/SKILL.md` — e.g. `skills/grimoire-draft/SKILL.md`. The slash-command name derives from the directory.

### Structure
- Every SKILL.md follows a consistent shape: title, triggers (when it activates), prerequisites (what must already exist), a numbered workflow, and an "Important"/constraints section. See `skills/grimoire-draft/SKILL.md` as an exemplar.
- The planned-change pipeline is `draft → plan → optional review → apply → verify → PR`. Design consultation and design output precede Draft when needed. `grimoire-spike` resolves engineering unknowns before delivery.
- `grimoire-precommit-review` remains available standalone and is invoked inside `grimoire-verify` during apply.
- Reference links use a relative path, e.g. `See ../references/review-personas.md`.

### Implementation lifecycle
- Plans use one or two substantial sections with activity-level review timing.
- Unknown behavior, contracts, causes, reproductions, or directions route to `grimoire-spike`.
- Planned delivery writes known tests first and uses at most one section confirmation.
- Understood bug fixes retain one observed red-green reproduction.
- Apply captures the baseline, implements substantial sections, then invokes one `grimoire-verify` procedure.
- Verify runs deterministic checks, one pre-commit review, accepted section corrections, and one final suite run.
- Generated commit hooks run only lint, format, and doc-style checks.
- Optional harness-level per-file review remains outside portable Grimoire task state.
- `skills/references/testing-lifecycle.md` is the authoritative lifecycle policy.

## Where New Code Goes
- New workflow skill → `skills/grimoire-<name>/SKILL.md`, then register it in `installSkillFiles()` (`src/core/shared-setup.ts`).
- Shared knowledge cited by 2+ skills → `skills/references/<name>.md` (see `references.md`).

## Structure (live)
For the full current inventory of skills and their cross-references, read the directory live:
- `skills/grimoire-*/SKILL.md` · `skills/references/*.md`
