# Core
> Last updated: 2026-05-17

## Purpose
All business logic for grimoire lives here. Each module corresponds to one CLI command (or a supporting capability). Core modules do the work; the commands layer just parses CLI options and calls them.

## Boundaries
- Core modules import from `../utils/` but never from `../commands/` or `../cli/`.
- Core modules own all I/O (filesystem, git, child processes). Commands only handle option parsing and exit codes.
- Test files live alongside their module (`detect.test.ts` next to `detect.ts`).
- Setup logic shared by `init` and `update` lives in `shared-setup.ts` — do not re-add to `init.ts` or `update.ts`.

## Key Files
| File | Responsibility |
|------|---------------|
| `src/core/init.ts` | Project initialization — scaffold dirs, detect tools, interactive Q&A, generate config, write brand artifacts |
| `src/core/update.ts` | Update AGENTS.md, skills, templates to latest version; migrate config; check npm registry for newer version |
| `src/core/shared-setup.ts` | Shared install logic — `ensureDirectories()`, `generateAgentFiles()`, `installSkillFiles()`, `installTemplates()`, `upsertAgentsFile()`. Used by both init and update. |
| `src/core/detect.ts` | Auto-detect languages, package managers, linters, formatters, test frameworks, BDD, security tools, dead-code analyzers, doc tools, comment style, surface |
| `src/core/validate.ts` | Validate Gherkin features, MADR decisions, and manifests for structural correctness |
| `src/core/map.ts` | Scan directory tree, detect key files, run jscpd, write `.snapshot.json` |
| `src/core/check.ts` | Pre-commit pipeline — run configured shell, LLM, complexity, doc-style, test-quality steps in sequence |
| `src/core/health.ts` | Project health scoring — features, decisions, area docs, schema, test coverage, duplicates, complexity; writes badges |
| `src/core/test-quality.ts` | Static analysis for weak tests — empty bodies, missing assertions, tautological conditions, swallowed errors (JS + Python) |
| `src/core/doc-style.ts` | Validate JSDoc / Python docstring style across changed files |
| `src/core/pr.ts` | Generate PR title and body from change artifacts; optional post-implementation LLM review; can create the PR via `gh` |
| `src/core/trace.ts` | Trace a file/line back through git commits to grimoire change IDs via trailers |
| `src/core/log.ts` | Generate release notes from `.grimoire/archive/` entries |
| `src/core/docs.ts` | Generate human-readable `OVERVIEW.md` by aggregating features, decisions, area docs, data schema, changes |
| `src/core/archive.ts` | Sync proposed features/decisions to baseline, move manifest to archive, remove change dir |
| `src/core/list.ts` | List active changes with status, or list all features/decisions; detect conflicts |
| `src/core/status.ts` | Show single change status — parse manifest frontmatter and task progress |
| `src/core/diff.ts` | Compare proposed change scenarios against baseline features |
| `src/core/ci.ts` | CI/CD orchestration — validate + check + test-quality; optional GHA annotations; can generate a workflow file |
| `src/core/hooks.ts` | Generate `.claude/hooks.json`, `.claude/settings.json`, and `.git/hooks/pre-commit` for enforcement |
| `src/core/branch-check.ts` | Branch-guard hook — detect new-feature intent in user prompts, suggest branch names, gate against dirty/mid-feature branches |

## Reusable Code
Utilities and helpers in this area that MUST be reused (not re-implemented):

| Function/Class | Location | What It Does |
|----------------|----------|-------------|
| `detectTools()` | `src/core/detect.ts` | Auto-detect project tools — returns `Detection[]` with category, name, confidence, signal, command |
| `ensureDirectories()` | `src/core/shared-setup.ts` | Create `.grimoire/{changes,decisions,docs,archive}` and `features/` |
| `generateAgentFiles()` | `src/core/shared-setup.ts` | Build the AGENTS.md content + caveman directive for the target project |
| `installSkillFiles()` | `src/core/shared-setup.ts` | Copy `skills/grimoire-*/` and `skills/references/` into `.claude/skills/` |
| `installTemplates()` | `src/core/shared-setup.ts` | Copy `templates/*` into `.grimoire/` (non-destructive) |
| `upsertAgentsFile()` | `src/core/shared-setup.ts` | Marker-based block update for AGENTS.md; guards against self-write when `root === packageRoot` |
| `ArchiveError` | `src/core/archive.ts` | Custom error class for archive failures — use instead of generic `Error` |

Module-private helpers in `shared-setup.ts` (not exported — call via the public verbs above): `upsertManagedBlock`, `buildManagedBlock`, `GRIMOIRE_START_MARKER`, `GRIMOIRE_END_MARKER`, `SKILL_AGENTS`, `DEFAULT_SKILL_AGENT`, `SKILL_SHARED_DIRS`.

## Patterns

### Module structure
Every core module follows the same pattern:
1. Interface definitions for options and results at the top
2. One exported async function as the entry point (e.g., `runCheck()`, `generateMap()`)
3. Private helper functions below
4. No classes — everything is functional (except `ArchiveError`)

### Shell execution
External commands use `promisify(execFile)` for simple commands, or `spawnWithStdin()` from `src/utils/spawn.ts` for commands needing stdin (LLM invocations). Shell commands use `sh -c` with a timeout.

### Config access
Modules that need project config call `loadConfig()` from utils. Modules that need the project root call `findProjectRoot()`. These are typically the first two lines of the entry function.

### Output
Modules that support `--json` output to stdout via `console.log(JSON.stringify(...))`. Human output uses `chalk` for colors. The `json` flag is passed through from the command layer.

### Error handling
Most modules return structured results rather than throwing. `archive.ts` is the exception with `ArchiveError`. File-not-found errors are caught and handled gracefully (empty arrays, null returns, skip messages).

### Public API
Core entry points are re-exported from `src/index.ts` for programmatic use (consumers importing `@kiwidata/grimoire`).

## Where New Code Goes
- New CLI commands → create `src/core/<name>.ts` for logic, `src/commands/<name>.ts` for CLI wrapper, register in `src/cli/index.ts`, optionally re-export from `src/index.ts`
- New tool detectors → add a function in `src/core/detect.ts` and add it to the `checks` array
- New health metrics → add an async function in `src/core/health.ts` and add it to the `Promise.all` call
- New check pipeline steps → configure in `.grimoire/config.yaml`; for built-in step types add a `run<Name>Step()` to `src/core/check.ts`
- New init/update logic that touches files in both flows → put in `src/core/shared-setup.ts`, not duplicated in `init.ts` and `update.ts`

## Known Duplicates
Most prior init/update duplication has been resolved by `shared-setup.ts`. Residual clones from latest snapshot:

| Files | Lines | What's Duplicated |
|-------|-------|------------------|
| `src/core/list.ts` ↔ `src/core/validate.ts` | 8 | Reading `.grimoire/changes/` directory entries |
| `src/core/trace.ts` `findInActive` ↔ `findInArchive` | small | Walking change manifests; consider extracting a shared scanner |
| `captureJson` helper across `*.test.ts` files | small | Test scaffolding — acceptable test duplication |

See `.grimoire/docs/.snapshot.json` `duplicates.clones` for the authoritative list.
