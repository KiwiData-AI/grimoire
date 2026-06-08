# Templates
> Last updated: 2026-06-07

## Purpose
Static files copied into a target project during `grimoire init` (and refreshed non-destructively by `grimoire update`). These are starting-point artifacts users customize per project.

## Boundaries
- Templates are plain text/JSON/YAML with no executable logic.
- Files in the `TEMPLATE_FILES` map are copied by `installTemplates()` in `src/core/shared-setup.ts`; init/update check `fileExists()` first so existing files are never overwritten unless `--force` is passed.
- Some templates are not in the copy map — they are referenced by skills at runtime instead (e.g. `example.feature`, `manifest.md`, `design-tool-setup-stub.md`, `brand-tokens-example.json`, `brand-voice-example.md`).

## Conventions

### Naming
- Named after the artifact they seed: `decision.md`, `constraints.md`, `context.yml`, `accepted-risks.yml`. Exemplar: `templates/constraints.md`.

### Structure
- Copy destinations live in the `TEMPLATE_FILES` array in `src/core/shared-setup.ts` as `[source, destination]` pairs (e.g. `decision.md → .grimoire/decisions/template.md`, `accepted-risks.yml → .grimoire/security/accepted-risks.yml`, `constraints.md → .grimoire/docs/constraints.md`). Add a new copied template by appending a pair there.
- All files under `templates/` are published to npm via the `files` array in `package.json`, so new template files ship automatically.

## Where New Code Goes
- New template file → `templates/<name>`.
- To have it copied during init/update → add a `[source, destination]` pair to `TEMPLATE_FILES` in `src/core/shared-setup.ts`. Otherwise reference it directly from the consuming skill.

## Structure (live)
For the current template files and their copy destinations, read live:
- `templates/*` · `TEMPLATE_FILES` in `src/core/shared-setup.ts`
