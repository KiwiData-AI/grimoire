# Utils
> Last updated: 2026-06-07

## Purpose
Shared infrastructure helpers used across core modules — config loading, path resolution, filesystem access, and process spawning.

## Boundaries
- Utils are imported by core modules (and indirectly by commands). They never import from core or commands.
- Utils are pure infrastructure — no grimoire-specific workflow logic.
- Prefer the helpers here over re-implementing: use `fileExists()`/`readFileOrNull()` instead of try/catch around `access()`/`readFile()`, `loadConfig()` instead of parsing YAML inline, `findProjectRoot()`/`safePath()` for path resolution.

## Conventions

### Naming
- Files are named after the concern: `config.ts`, `paths.ts`, `fs.ts`, `spawn.ts`. Helpers are plain camelCase verbs (`fileExists`, `findProjectRoot`, `spawnWithStdin`). Exemplar: `src/utils/fs.ts`.

### Structure
- `loadConfig()` always returns a fully-defaulted `GrimoireConfig`, even when the YAML file is missing or malformed, and transparently upgrades the legacy flat format to the nested format. Add new config fields by extending the interfaces and adding a sub-parser (`parseProject`, `parseLlm`, etc.) rather than inlining — see `src/utils/config.ts`.
- Path helpers validate against traversal and keep resolved paths inside the project root (`safePath`, `resolveChangePath` in `src/utils/paths.ts`).
- `spawnWithStdin()` in `src/utils/spawn.ts` pipes a prompt to a child process's stdin (for LLM/agent CLIs), returns `{ stdout, stderr, code }`, and honors timeout/abort.

## Where New Code Goes
- New utility function → add to the appropriate file in `src/utils/`.
- New config field → extend the interfaces in `src/utils/config.ts`, add a sub-parser, wire it into `loadConfig()`.
- Do NOT put grimoire workflow logic here — that belongs in `src/core/`.

## Structure (live)
For key files, symbols, and reusable helpers in this area, query the graph — it is always current:
- `get_architecture(area="src/utils")` · `search_graph(qn_pattern="src/utils.*")`
