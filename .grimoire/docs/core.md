# Core
> Last updated: 2026-04-05

## Purpose
All business logic for grimoire lives here. Each module corresponds to one CLI command (or a supporting capability like symbol extraction). Core modules do the actual work; the commands layer just parses CLI options and calls these.

## Boundaries
- Core modules import from `../utils/` but never from `../commands/` or `../cli/`.
- Core modules own all I/O (filesystem, git, child processes). Commands only handle option parsing and exit codes.
- Test files live alongside their module (`detect.test.ts` next to `detect.ts`).

## Key Files
| File | Responsibility |
|------|---------------|
| `src/core/init.ts` | Project initialization — scaffold dirs, detect tools, generate config, install AGENTS.md/skills/hooks |
| `src/core/update.ts` | Update AGENTS.md and skills to latest version (shares code with init — see Known Duplicates) |
| `src/core/detect.ts` | Auto-detect languages, package managers, linters, formatters, test frameworks, security tools (25+ detectors) |
| `src/core/validate.ts` | Validate Gherkin features, MADR decisions, and manifests for structural correctness |
| `src/core/map.ts` | Scan directory tree, detect key files, extract symbols, run jscpd, write `.snapshot.json` |
| `src/core/symbols.ts` | Regex-based symbol extraction for Python, TypeScript/JS, Go, Rust — functions, classes, exports with line numbers |
| `src/core/check.ts` | Pre-commit pipeline — run configured tool steps and LLM review steps in sequence |
| `src/core/health.ts` | Project health scoring — features, decisions, area docs, data schema, test coverage, duplicates, complexity |
| `src/core/test-quality.ts` | Static analysis for weak tests — empty bodies, missing assertions, tautological conditions |
| `src/core/pr.ts` | Generate PR title and body from change artifacts; optional post-implementation LLM review |
| `src/core/trace.ts` | Trace a file/line back through git commits to grimoire change IDs via trailers |
| `src/core/log.ts` | Generate release notes from `.grimoire/archive/` entries |
| `src/core/docs.ts` | Generate human-readable `OVERVIEW.md` by aggregating features, decisions, area docs, changes |
| `src/core/archive.ts` | Sync proposed features/decisions to baseline, move manifest to archive, remove change dir |
| `src/core/list.ts` | List active changes with status, or list all features/decisions; detect conflicts |
| `src/core/status.ts` | Show single change status — parse manifest frontmatter and task progress |
| `src/core/diff.ts` | Compare proposed change scenarios against baseline features |
| `src/core/hooks.ts` | Generate `.claude/hooks.json` and `.git/hooks/pre-commit` for enforcement |
| `src/core/ci.ts` | CI/CD orchestration — validate + check + test-quality; optional GHA annotations |

## Reusable Code
Utilities and helpers in this area that MUST be reused (not re-implemented):

| Function/Class | Location | What It Does |
|----------------|----------|-------------|
| `detectTools()` | `src/core/detect.ts:56` | Auto-detect project tools — returns `Detection[]` with category, name, confidence, signal, command |
| `extractSymbols()` | `src/core/symbols.ts:26` | Extract function/class/export symbols from source files — returns `SymbolMap` |
| `generateCompressedMap()` | `src/core/symbols.ts:410` | Generate `.symbols.md` from `SymbolInfo[]` — compact repomix-style format for LLM consumption |
| `ArchiveError` | `src/core/archive.ts:10` | Custom error class for archive failures — use instead of generic Error |
| `spawnWithStdin()` | `src/core/check.ts:291` | Spawn a process with stdin piped — used for LLM commands. Also duplicated in `pr.ts:390` |

## Patterns

### Module structure
Every core module follows the same pattern:
1. Interface definitions for options and results at the top
2. One exported async function as the entry point (e.g., `runCheck()`, `generateMap()`)
3. Private helper functions below
4. No classes — everything is functional

### Shell execution
External commands use `promisify(execFile)` for simple commands, or the custom `spawnWithStdin()` for commands needing stdin. Shell commands go through `sh -c` with a timeout.

### Config access
Modules that need project config call `loadConfig()` from utils. Modules that need the project root call `findProjectRoot()`. These are always the first two lines of the entry function.

### Output
Modules that support `--json` output to stdout via `console.log(JSON.stringify(...))`. Human output uses `chalk` for colors. The `json` flag is passed through from the command layer.

### Error handling
Most modules return structured results rather than throwing. `archive.ts` is the exception with `ArchiveError`. File-not-found errors are caught and handled gracefully (empty arrays, null returns, skip messages).

## Where New Code Goes
- New CLI commands → create `src/core/<name>.ts` for logic, `src/commands/<name>.ts` for CLI wrapper
- New tool detectors → add a function in `src/core/detect.ts` and add it to the `checks` array
- New language support for symbol extraction → add `extract<Lang>Symbols()` in `src/core/symbols.ts`
- New health metrics → add an async function in `src/core/health.ts` and add it to the `Promise.all` call
- New check pipeline steps → configure in `.grimoire/config.yaml`, no code change needed

## Known Duplicates
| Files | Lines | What's Duplicated |
|-------|-------|------------------|
| `src/core/init.ts:1-9` ↔ `src/core/update.ts:1-9` | 9 | Imports + `__dirname`/`PACKAGE_ROOT` setup |
| `src/core/init.ts:106-139` ↔ `src/core/update.ts:43-76` | ~34 | `setupAgentsFile()` — AGENTS.md marker-based update logic |
| `src/core/init.ts:139-175` ↔ `src/core/update.ts:76-112` | ~36 | `installSkills()` — skill file copy loop |
| `src/core/list.ts:20-27` ↔ `src/core/validate.ts:29-35` | 8 | Reading `.grimoire/changes/` directory entries |
| `src/core/check.ts:291-327` ↔ `src/core/pr.ts:390-426` | 37 | `spawnWithStdin()` — identical function in both files |

The `init.ts`/`update.ts` duplication is the largest. The shared logic (AGENTS.md updates, skill installation) could be extracted to a shared module. The `spawnWithStdin()` duplicate should be moved to `src/utils/`.
