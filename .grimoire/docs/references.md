# Skill References
> Last updated: 2026-05-17

## Purpose
Shared knowledge documents that workflow skills load on demand. Reference files keep SKILL.md files short by externalising long persona lists, rubrics, format specs, and heuristics. Multiple skills can cite the same reference without duplicating it.

## Boundaries
- Reference files live in `skills/references/` and ship to target projects via `installSkillFiles()` in `src/core/shared-setup.ts`.
- References are pure markdown — no code, no executable steps.
- Each reference should be self-contained and load-on-demand: a SKILL.md links to it (`See ../references/<name>.md`) rather than embedding the content.

## Key Files
| File | Used By | What It Provides |
|------|---------|------------------|
| `skills/references/adversarial-personas.md` | review, pr-review, precommit-review | Adversarial personas for finding gaps and edge cases |
| `skills/references/elicitation-personas.md` | design-consult, draft | Personas that interview the designer/engineer to surface assumptions |
| `skills/references/review-personas.md` | review, pr-review, precommit-review | Multi-perspective reviewer personas (PM, engineer, security, data) |
| `skills/references/bug-classification.md` | bug-triage, bug | 8-way root cause classification taxonomy |
| `skills/references/build-vs-buy.md` | draft, design-consult | Decision rubric for in-house vs third-party solutions |
| `skills/references/code-quality.md` | apply, plan, precommit-review | Code-quality heuristics to follow at write time |
| `skills/references/design-heuristics.md` | design | UX/UI design principles |
| `skills/references/design-input-formats.md` | design, draft | Accepted formats for design input (Figma, screenshots, sketches) |
| `skills/references/brand-tokens-format.md` | design | DTCG brand token JSON format spec |
| `skills/references/visual-fidelity.md` | review, design | Visual fidelity checklist |
| `skills/references/schema-format.md` | discover, audit | YAML format for `.grimoire/docs/data/schema.yml` |
| `skills/references/security-compliance.md` | review, design-consult | Security and compliance review rubric |
| `skills/references/testing-contracts.md` | apply, plan | Contract-first API test patterns |
| `skills/references/refactor-scan-categories.md` | refactor | Categories scanned during tech-debt sweep |
| `skills/references/refactor-register-format.md` | refactor | Format for the refactor register output |

## Patterns

### Naming
- `<subject>-<purpose>.md` (e.g., `review-personas.md`, `schema-format.md`).
- Subject describes what's inside; purpose distinguishes related files (personas vs heuristics vs format).

### Linking from a skill
Skills link with a relative path:
```markdown
See `../references/schema-format.md` for the full YAML format with examples.
```

### Distribution
References are copied alongside skills into the target project's `.claude/skills/references/`. Path references in installed SKILL.md files resolve identically there.

## Where New Code Goes
- New reusable knowledge doc cited by 2+ skills → `skills/references/<name>.md`
- Knowledge used by only one skill → keep it inline in that SKILL.md
- After adding, link from the consuming skills and verify `installSkillFiles()` picks up the new file (it copies the whole `references/` directory)
