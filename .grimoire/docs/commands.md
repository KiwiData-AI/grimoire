# Commands
> Last updated: 2026-05-17

## Purpose
Thin CLI wrappers that parse options with commander.js and delegate to core functions. Each file exports a single `Command` object registered in `src/cli/index.ts`.

## Boundaries
- Commands ONLY parse options and call core functions. No business logic.
- Commands handle exit codes (`process.exit(1)` on failure) and the `--json` output flag.
- Commands import from `../core/` — never from other commands or utils directly.

## Key Files
| File | CLI |
|------|-----|
| `src/commands/init.ts` | `grimoire init [path]` |
| `src/commands/update.ts` | `grimoire update [path]` |
| `src/commands/validate.ts` | `grimoire validate [id]` |
| `src/commands/check.ts` | `grimoire check [steps...]` |
| `src/commands/map.ts` | `grimoire map [--refresh] [--duplicates]` |
| `src/commands/health.ts` | `grimoire health` |
| `src/commands/pr.ts` | `grimoire pr [id]` |
| `src/commands/test-quality.ts` | `grimoire test-quality [files...]` |
| `src/commands/list.ts` | `grimoire list` |
| `src/commands/status.ts` | `grimoire status <id>` |
| `src/commands/archive.ts` | `grimoire archive <id>` |
| `src/commands/trace.ts` | `grimoire trace <file>` |
| `src/commands/log.ts` | `grimoire log` |
| `src/commands/docs.ts` | `grimoire docs` |
| `src/commands/diff.ts` | `grimoire diff <id>` |
| `src/commands/ci.ts` | `grimoire ci` (also `ci generate` for workflow scaffold) |
| `src/commands/branch-check.ts` | `grimoire branch-check` (invoked by Claude Code UserPromptSubmit hook) |

The list in `src/cli/index.ts` is authoritative — update there when adding/removing a command.

## Patterns

### Structure
Every command file looks the same:
```ts
import { Command } from "commander";
import { coreFunction } from "../core/<name>.js";

export const <name>Command = new Command("<name>")
  .description("...")
  .argument(...)
  .option(...)
  .action(async (...) => {
    await coreFunction(options);
  });
```

### Registration
All commands are registered in `src/cli/index.ts` via `program.addCommand()`. The CLI entry point is `bin/grimoire.js` — a one-line shim that imports the compiled `dist/cli/index.js`.

### Adding a new command
1. Create `src/core/<name>.ts` with the business logic + test sibling
2. Create `src/commands/<name>.ts` with the commander wrapper
3. Import and register in `src/cli/index.ts`
4. Optionally re-export the core function from `src/index.ts` for programmatic use

## Where New Code Goes
- New commands → `src/commands/<name>.ts`
- Command logic → always in `src/core/`, never here
