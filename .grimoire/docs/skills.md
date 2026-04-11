# Skills
> Last updated: 2026-04-11

## Purpose
Claude Code skill definitions that provide the AI-driven workflow. Each skill is a `SKILL.md` file that Claude Code loads as a slash command (e.g., `/grimoire:draft`). Skills are the primary interface between users and the grimoire workflow.

## Boundaries
- Skills are markdown files, not code. They define workflow instructions for AI assistants.
- Skills are copied into the target project's `.claude/skills/` during `grimoire init` and `grimoire update`.
- Skills reference CLI commands (`grimoire validate`, `grimoire check`) but don't contain executable code.

## Key Files
| File | Responsibility |
|------|---------------|
| `skills/grimoire-draft/SKILL.md` | Route requests to features/decisions/bugs, scaffold change, draft artifacts |
| `skills/grimoire-plan/SKILL.md` | Generate implementation tasks from approved specs |
| `skills/grimoire-review/SKILL.md` | Multi-perspective design review (PM, engineer, security, data) |
| `skills/grimoire-apply/SKILL.md` | Execute tasks with strict red-green BDD cycle |
| `skills/grimoire-verify/SKILL.md` | Post-implementation verification — completeness, correctness, coherence |
| `skills/grimoire-audit/SKILL.md` | Discover undocumented features and decisions in existing codebase |
| `skills/grimoire-discover/SKILL.md` | Generate area docs and data schema from codebase snapshot |
| `skills/grimoire-remove/SKILL.md` | Tracked feature/decision removal with impact assessment |
| `skills/grimoire-bug/SKILL.md` | Disciplined bug fix — reproduce first, classify, fix, generate tester verification checklist |
| `skills/grimoire-bug-report/SKILL.md` | Structured bug reporting for testers — interview-style, test tool input, spec linking |
| `skills/grimoire-bug-triage/SKILL.md` | Triage bug reports — 8-way root cause classification, routing, security handling |
| `skills/grimoire-bug-explore/SKILL.md` | Exploratory testing — gap analysis, automation coverage mapping, tester/developer modes, onboarding |
| `skills/grimoire-bug-session/SKILL.md` | Guided exploratory testing sessions — charter, progress tracking, timebox, debrief |
| `skills/grimoire-commit/SKILL.md` | Generate contextual commit messages with change trailers |
| `skills/grimoire-pr/SKILL.md` | Generate PR descriptions from grimoire artifacts |

## Patterns

### Skill structure
Every SKILL.md follows a consistent format:
1. **Title** — skill name
2. **Triggers** — when the skill activates
3. **Prerequisites** — what must exist (e.g., approved specs, snapshot)
4. **Workflow** — numbered steps with detailed instructions
5. **Important** — critical constraints (e.g., "don't re-plan", "reproduce before fixing")

### Workflow sequence
Skills form a pipeline: `draft → plan → review → apply → verify → archive`

Each skill trusts the output of the previous one. The plan skill reads specs from draft. The apply skill reads tasks from plan. The verify skill checks implementation against specs.

## Where New Code Goes
- New skills → `skills/<name>/SKILL.md`
- Add the skill name to the `skillNames` array in `src/core/init.ts:581` and `src/core/update.ts`
