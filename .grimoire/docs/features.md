# Features
> Last updated: 2026-06-07

## Purpose
Gherkin specifications for grimoire's own behavior. Each `.feature` file describes how grimoire works — these are the contracts the CLI, skills, and workflows must honor.

## Boundaries
- `features/` is the single home for every spec. Changes are made live on the feature branch by editing these files directly; git history is the record of what changed — there is no separate proposed/baseline copy and no archive.
- Features are reference docs for humans and AI agents; they are not executed. `grimoire validate` parses them for structure but does not run them as tests.
- Specs are grouped by area subdirectory — pick the directory matching the feature's primary user concern (e.g. `features/cli/` for CLI command behavior, `features/workflow/` for the skill pipeline, `features/bug/` for bug-handling skills).

## Conventions

### Naming
- One feature per file, lowercase-kebab-case naming the scenario subject, a noun phrase or action not a question — e.g. `features/brand/lint-brand-drift.feature`.

### Structure
- Standard Gherkin: a `Feature:` header with summary, optional `Background:`, then one or more `Scenario:` / `Scenario Outline:` blocks. `grimoire validate` enforces these elements via `parseGherkin()` in `src/core/validate.ts`. Exemplar: `features/cli/check.feature`.
- Each top-level subdirectory under `features/` is an area; create a new one only when an existing area genuinely doesn't fit.

## Where New Code Goes
- New feature describing grimoire behavior → `features/<area>/<name>.feature`, edited directly on the feature branch.
- New area subdirectory → create it under `features/` only when no existing area fits.

## Structure (live)
For the current set of areas and feature files, read the directory live:
- `features/*/*.feature`
