# Core
> Last updated: 2026-06-07

## Purpose
All business logic for grimoire lives here. Most modules back one CLI command; the rest are supporting capabilities (tool detection, shared setup, hook generation, risk register). The commands layer just parses CLI options and calls into core.

## Boundaries
- Core modules import from `../utils/` but never from `../commands/` or `../cli/`.
- Core modules own all I/O (filesystem, git, child processes). Commands only handle option parsing and exit codes.
- Test files live alongside their module (`detect.test.ts` next to `detect.ts`).
- Setup logic shared by `init` and `update` lives in `shared-setup.ts` — do not re-add it to `init.ts` or `update.ts`.
- Everything is functional — no classes. Modules return structured results rather than throwing; file-not-found is handled gracefully (empty arrays, null returns, skip messages).

## Conventions

### Naming
- One module per command, named after the verb: `check.ts`, `validate.ts`, `pr.ts`. Supporting capabilities are named after their domain: `detect.ts`, `shared-setup.ts`, `risk-register.ts`.
- The exported entry point is `run<Verb>()` or `generate<Noun>()` — e.g. `runCheck()` in `src/core/check.ts`, `detectTools()` in `src/core/detect.ts`.

### Structure
- Each module opens with interface definitions for its options and results, exposes a single exported async entry function, then keeps private helpers below it. See `src/core/check.ts` for the canonical shape.
- Shell execution: `promisify(execFile)` for simple commands, or `spawnWithStdin()` from `src/utils/spawn.ts` for commands needing stdin (LLM invocations). Shell steps run via `sh -c` with a timeout.
- Config access: modules call `loadConfig()` and/or `findProjectRoot()` from `../utils/` as the first lines of the entry function.
- Output: `--json` mode prints `JSON.stringify(...)` to stdout; human output uses `chalk`. The `json` flag is threaded down from the command layer.
- Public API: core entry points are re-exported from `src/index.ts` for programmatic consumers of `@kiwidata/grimoire`.

## Where New Code Goes
- New CLI command → `src/core/<name>.ts` for logic (+ `<name>.test.ts`), `src/commands/<name>.ts` for the wrapper, register in `src/cli/index.ts`, optionally re-export from `src/index.ts`.
- New tool detector → add a function in `src/core/detect.ts` and wire it into the checks array.
- New health metric → add an async function in `src/core/health.ts` and include it in the `Promise.all`.
- New check-pipeline step → configure in `.grimoire/config.yaml`; for a built-in step type add a `run<Name>Step()` to `src/core/check.ts`.
- Init/update logic touching files in both flows → `src/core/shared-setup.ts`, never duplicated into `init.ts`/`update.ts`.

## Structure (live)
For key files, symbols, reusable utilities, call graphs, and duplicates in this area,
query the graph — it is always current:
- `get_architecture(area="src/core")` · `search_graph(qn_pattern="src/core.*")`
- duplicates: `grimoire health` (config-driven `duplicates` metric)
