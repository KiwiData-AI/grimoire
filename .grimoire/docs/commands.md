# Commands
> Last updated: 2026-06-07

## Purpose
Thin CLI wrappers that parse options with commander.js and delegate to core functions. Each file exports a single `Command` object registered in `src/cli/index.ts`.

## Boundaries
- Commands ONLY parse options and call core functions. No business logic.
- Commands handle exit codes (`process.exit(1)` on failure) and the `--json` output flag.
- Commands import from `../core/` — never from other commands or from utils directly.
- The command list in `src/cli/index.ts` is authoritative — update it when adding or removing a command.

## Conventions

### Naming
- One file per command, named after the verb it exposes: `src/commands/check.ts` backs `grimoire check`. The exported symbol is `<name>Command`.

### Structure
- Every command file imports `Command` from commander and the core function, then builds the command with `.description()`, `.argument()`, `.option()`, and an async `.action()` that calls the core function. See `src/commands/check.ts` for the canonical shape.
- All commands are registered in `src/cli/index.ts` via `program.addCommand()`. The CLI entry point is `bin/grimoire.js`, a one-line shim that imports the compiled `dist/cli/index.js`.

## Where New Code Goes
- New command → `src/commands/<name>.ts`, then register it in `src/cli/index.ts`.
- Command logic → always in `src/core/<name>.ts`, never here.

## Structure (live)
For key files, symbols, and call graphs in this area, query the graph — it is always current:
- `get_architecture(area="src/commands")` · `search_graph(qn_pattern="src/commands.*")`
