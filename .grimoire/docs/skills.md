# Skills
> Last updated: 2026-05-17

## Purpose
Claude Code skill definitions that provide the AI-driven workflow. Each skill is a `SKILL.md` file loaded as a slash command (e.g., `/grimoire:draft`). Skills are the primary interface between users and the grimoire workflow.

## Boundaries
- Skills are markdown files, not code. They define workflow instructions for AI assistants.
- Skills are copied into the target project's `.claude/skills/` during `grimoire init` and `grimoire update` via `installSkillFiles()` in `src/core/shared-setup.ts`.
- Skills reference CLI commands (`grimoire validate`, `grimoire check`) but don't contain executable code.
- The authoritative skill list lives in `installSkillFiles()` — when adding a new skill, register it there.

## Workflow Skills
| File | Responsibility |
|------|---------------|
| `skills/grimoire-draft/SKILL.md` | Route requests to features/decisions/bugs, scaffold change, draft artifacts |
| `skills/grimoire-design-consult/SKILL.md` | Pre-design Q&A with security and data personas; distills assumptions and open questions |
| `skills/grimoire-design/SKILL.md` | Generate UI/UX designs grounded in a user problem — variants, states, brand-token compliance, derived Gherkin |
| `skills/grimoire-plan/SKILL.md` | Generate implementation tasks from approved specs |
| `skills/grimoire-review/SKILL.md` | Multi-perspective design review (PM, engineer, security, data) |
| `skills/grimoire-apply/SKILL.md` | Execute tasks with strict red-green BDD cycle |
| `skills/grimoire-verify/SKILL.md` | Post-implementation verification — completeness, correctness, coherence |
| `skills/grimoire-commit/SKILL.md` | Generate contextual commit messages with change trailers |
| `skills/grimoire-precommit-review/SKILL.md` | Multi-persona review of local staged/unstaged diff before commit |
| `skills/grimoire-pr/SKILL.md` | Generate PR descriptions from grimoire artifacts |
| `skills/grimoire-pr-review/SKILL.md` | Review a teammate's PR with multi-persona lens against the actual diff |
| `skills/grimoire-branch-guard/SKILL.md` | Enforce branch hygiene at new-feature kick-off |
| `skills/grimoire-remove/SKILL.md` | Tracked feature/decision removal with impact assessment |
| `skills/grimoire-refactor/SKILL.md` | Find, prioritize, and plan tech debt reduction |

## Onboarding Skills
| File | Responsibility |
|------|---------------|
| `skills/grimoire-discover/SKILL.md` | Generate area docs and data schema from codebase snapshot |
| `skills/grimoire-audit/SKILL.md` | Discover undocumented features and decisions in existing codebase |

## Bug Skills
| File | Responsibility |
|------|---------------|
| `skills/grimoire-bug/SKILL.md` | Disciplined bug fix — reproduce first, classify, fix, tester verification checklist |
| `skills/grimoire-bug-report/SKILL.md` | Structured bug reporting for testers — interview-style, test tool input, spec linking |
| `skills/grimoire-bug-triage/SKILL.md` | Triage bug reports — 8-way root cause classification, routing, security handling |
| `skills/grimoire-bug-explore/SKILL.md` | Exploratory testing — gap analysis, automation coverage mapping, onboarding |
| `skills/grimoire-bug-session/SKILL.md` | Guided exploratory testing sessions — charter, progress tracking, timebox, debrief |

## Reference Library
`skills/references/*.md` are shared knowledge documents that workflow skills load on demand. See `.grimoire/docs/references.md` for the inventory. Examples: `adversarial-personas.md`, `review-personas.md`, `schema-format.md`, `code-quality.md`, `bug-classification.md`, `design-heuristics.md`.

## Patterns

### Skill structure
Every SKILL.md follows a consistent format:
1. **Title** — skill name
2. **Triggers** — when the skill activates
3. **Prerequisites** — what must exist (e.g., approved specs, snapshot)
4. **Workflow** — numbered steps with detailed instructions
5. **Important** — critical constraints

### Workflow sequence
Skills form a pipeline: `branch-guard → draft → design-consult → design → plan → review → apply → verify → precommit-review → commit → pr → pr-review → archive`

Each skill trusts the output of the previous one. The plan skill reads specs from draft. The apply skill reads tasks from plan. The verify skill checks implementation against specs.

### Skill installation
1. Add the skill name to the list inside `installSkillFiles()` in `src/core/shared-setup.ts`
2. `grimoire init` and `grimoire update` will copy it into target projects' `.claude/skills/`

## Where New Code Goes
- New workflow skill → `skills/<name>/SKILL.md` and register in `installSkillFiles()` (`src/core/shared-setup.ts`)
- Shared knowledge document referenced by multiple skills → `skills/references/<name>.md`
