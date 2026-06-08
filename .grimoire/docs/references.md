# Skill References
> Last updated: 2026-06-07

## Purpose
Shared knowledge documents that workflow skills load on demand. Reference files keep SKILL.md files short by externalising long persona lists, rubrics, format specs, and heuristics so multiple skills can cite the same document without duplicating it.

## Boundaries
- Reference files live in `skills/references/` and ship to target projects via `installSkillFiles()` in `src/core/shared-setup.ts` (the whole `references/` directory is copied).
- References are pure markdown — no code, no executable steps.
- Each reference is self-contained and load-on-demand: a SKILL.md links to it (`See ../references/<name>.md`) rather than embedding the content.

## Conventions

### Naming
- `<subject>-<purpose>.md` — the subject describes what's inside, the purpose distinguishes related files (personas vs heuristics vs format). Exemplar: `skills/references/review-personas.md`.

### Structure
- A skill links a reference with a relative path, e.g. ``See `../references/schema-format.md` for the full YAML format``. Installed SKILL.md files resolve the same relative path in the target project's `.claude/skills/references/`.
- Single-skill knowledge stays inline in that SKILL.md; only knowledge shared by 2+ skills becomes a reference.

## Where New Code Goes
- New reusable knowledge doc cited by 2+ skills → `skills/references/<name>.md`, then link it from the consuming skills.
- Knowledge used by only one skill → keep it inline in that SKILL.md.

## Structure (live)
For the current inventory of references and which skills cite each, read the directory live:
- `skills/references/*.md` · grep the citing skills with `grep -rl references/<name>.md skills/`
