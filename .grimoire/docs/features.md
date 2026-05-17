# Features
> Last updated: 2026-05-17

## Purpose
Gherkin specifications for grimoire's own behavior. Each `.feature` file is a baseline spec describing how grimoire works — these are the contracts the CLI, skills, and workflows must honor.

## Boundaries
- `features/` holds **baseline** specs (approved, in-effect behavior). Proposed changes live in `.grimoire/changes/<id>/features/` until archived.
- Features are reference docs for humans and AI agents; they are not automatically executed. (`grimoire validate` parses them for structure but does not run them as tests.)
- Grouped by area subdirectory — pick the directory that matches the feature's primary user concern.

## Area Subdirectories
| Directory | Scope |
|-----------|-------|
| `features/cli/` | Behavior of `grimoire` CLI commands (`init`, `check`, `validate`, `map`, `pr`, `archive`, `health`, `trace`) |
| `features/workflow/` | End-to-end skill workflow — `draft`, `apply`, `verify` |
| `features/draft/` | Drafting-time concerns (e.g., consuming Figma designs into a draft) |
| `features/design/` | Design skill behavior — variants, component states, derived Gherkin, session initiation |
| `features/design-consult/` | Pre-design Q&A and consult flow |
| `features/onboarding/` | First-run setup — surface detection, brand capture, design tool MCP setup |
| `features/review/` | Review skill behavior — adversarial personas, conditional persona selection, visual fidelity checks |
| `features/intelligence/` | Static-analysis features — test-quality checks (symbol extraction superseded by `codebase-memory-mcp`; see ADR-0029) |
| `features/brand/` | Brand drift linting |
| `features/bug/` | Bug-handling skill behaviors — fix workflow, reporting, triage, exploratory testing, timeboxed sessions |

## Patterns

### File naming
- One feature per file, lowercase-kebab-case matching the scenario subject (e.g., `lint-brand-drift.feature`).
- Filename should be a noun phrase or action — not a question.

### Feature structure
Standard Gherkin: `Feature:` header with summary, optional `Background:`, then one or more `Scenario:` / `Scenario Outline:` blocks. `grimoire validate` enforces presence of these elements via `parseGherkin()` in `src/core/validate.ts`.

### Change lifecycle
1. Draft skill adds a proposed `.feature` file inside `.grimoire/changes/<id>/features/<area>/`
2. After implementation + verify, `grimoire archive <id>` moves the proposed file into the canonical `features/<area>/` location and removes the change dir
3. The archived manifest in `.grimoire/archive/<date>-<id>/` keeps the diff for history

## Where New Code Goes
- New feature describing in-effect behavior → `features/<area>/<name>.feature`
- New feature being proposed → `.grimoire/changes/<id>/features/<area>/<name>.feature` (created by the draft skill, never authored directly here)
- New area subdirectory → create it under `features/` only when an existing area genuinely doesn't fit
