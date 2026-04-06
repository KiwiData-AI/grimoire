# Contributing to Grimoire

## Architecture Overview

```
bin/grimoire.js          CLI entry point (loads dist/cli/index.js)
│
src/cli/index.ts         Registers all 16 commands with commander.js
│
src/commands/*.ts        Thin wrappers — parse CLI options, call core functions, handle exit codes
│
src/core/*.ts            Business logic — one module per command, plus shared capabilities
│
src/utils/*.ts           Infrastructure — config loading, path resolution, filesystem helpers
│
skills/*/SKILL.md        AI workflow definitions (copied to target projects during init)
│
templates/*              Static files copied during grimoire init
│
features/**/*.feature    Gherkin specs — the behavioral contract for grimoire itself
│
.grimoire/decisions/     Architecture decisions (MADR format)
│
AGENTS.md                Universal AI assistant instructions (bundled into target projects)
```

### How a command works

Every command follows the same flow:

1. User runs `grimoire <command> [options]`
2. `src/commands/<command>.ts` parses options with commander.js
3. Calls the core function from `src/core/<command>.ts`
4. Core function loads config via `loadConfig()`, finds project root via `findProjectRoot()`
5. Does the actual work, returns structured results
6. Command handles output format (human-readable or `--json`)

### Key modules

**Project setup:** `init.ts` auto-detects tools, scaffolds directories, installs AGENTS.md + skills + hooks. `update.ts` refreshes AGENTS.md and skills without touching config.

**Codebase intelligence:** `map.ts` scans the directory tree and writes `.snapshot.json`. `symbols.ts` extracts function signatures with regex (no tree-sitter). `docs.ts` aggregates everything into `OVERVIEW.md`.

**Quality:** `check.ts` runs the pre-commit pipeline (tool steps + LLM review steps). `test-quality.ts` detects weak assertions. `health.ts` scores the project across 8 metrics.

**Change management:** `validate.ts` checks Gherkin/MADR/manifest structure. `list.ts` and `status.ts` show active changes. `archive.ts` syncs to baseline and archives.

**Traceability:** `trace.ts` follows a file through git commits back to grimoire change IDs. `log.ts` generates release notes from the archive.

### Where things live

| You want to... | Look at |
|----------------|---------|
| Add a CLI command | `src/commands/` (wrapper) + `src/core/` (logic) + register in `src/cli/index.ts` + export from `src/index.ts` |
| Add a tool detector | `src/core/detect.ts` — add a function, add it to the `checks` array |
| Add language support for symbols | `src/core/symbols.ts` — add `extract<Lang>Symbols()` |
| Add a health metric | `src/core/health.ts` — add an async function, add to `Promise.all` |
| Add a skill | `skills/<name>/SKILL.md` + add to `skillNames` in `init.ts` and `update.ts` |
| Add a template | `templates/` + copy logic in `init.ts` + add to `files` in `package.json` |
| Add/change config | Interfaces in `src/utils/config.ts` + handle in `loadConfig()` |
| Understand the project | `.grimoire/docs/` (area docs) or `features/` (behavioral specs) |

## Development

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript
npm run dev              # Watch mode
npm test                 # Run tests (vitest)
npm run lint             # ESLint
```

### Running locally

```bash
npm run build && node bin/grimoire.js <command>
```

Or link globally for testing:

```bash
npm link
grimoire <command>
```

### Tests

Tests use vitest and live next to their modules (`src/core/detect.test.ts`). Coverage threshold is 50% lines. CLI commands are excluded from coverage (they're thin wrappers).

```bash
npx vitest                    # Watch mode
npx vitest run                # Single run
npx vitest run --coverage     # With coverage report
```

### Code style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **ESM** — all imports use `.js` extensions (TypeScript ESM convention)
- **Functional** — no classes in core modules (except `ArchiveError`). Export async functions.
- **chalk for output** — all human-readable output uses chalk. JSON output uses `console.log(JSON.stringify(...))`.
- **Errors at boundaries** — validate input in commands, trust internal calls in core

### Dependencies

Grimoire has 4 runtime dependencies by design:
- `commander` — CLI framework
- `chalk` — terminal colors
- `yaml` — YAML parsing
- `fast-glob` — file globbing

Adding a dependency needs a good reason. Prefer Node.js built-ins (`fs`, `path`, `child_process`).

## Project documentation

- **README.md** — User-facing docs (install, quick start, command reference)
- **AGENTS.md** — AI assistant instructions (bundled into target projects, ~350 lines)
- **RESEARCH.md** — Design rationale, problem space research, competitive landscape
- **features/*.feature** — Behavioral specs in Gherkin (the source of truth for what grimoire does)
- **.grimoire/decisions/** — Architecture decisions in MADR format (why we made each choice)
- **.grimoire/docs/** — Area docs (how the codebase is organized, what's reusable)

For the full picture of what grimoire does and why, read `features/` first, then `RESEARCH.md`, then the decision records.
