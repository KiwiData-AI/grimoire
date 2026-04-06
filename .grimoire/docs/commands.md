# Commands
> Last updated: 2026-04-05

## Purpose
Thin CLI wrappers that parse options with commander.js and delegate to core functions. Each file exports a single `Command` object that gets registered in `src/cli/index.ts`.

## Boundaries
- Commands ONLY parse options and call core functions. No business logic here.
- Commands handle exit codes (`process.exit(1)` on failure) and the `--json` output flag.
- Commands import from `../core/` — never from other commands or utils directly.

## Key Files
| File | Responsibility |
|------|---------------|
| `src/commands/init.ts` | `grimoire init [path]` — delegates to `initProject()` |
| `src/commands/update.ts` | `grimoire update [path]` — delegates to `updateProject()` |
| `src/commands/validate.ts` | `grimoire validate [id]` — delegates to `validateChange()` |
| `src/commands/check.ts` | `grimoire check [steps...]` — delegates to `runCheck()` |
| `src/commands/map.ts` | `grimoire map` — delegates to `generateMap()` |
| `src/commands/health.ts` | `grimoire health` — delegates to `runHealth()` |
| `src/commands/pr.ts` | `grimoire pr [id]` — delegates to `generatePr()` |
| `src/commands/test-quality.ts` | `grimoire test-quality [files]` — delegates to `analyzeTestQuality()` |
| `src/commands/list.ts` | `grimoire list` — delegates to `listChanges/Features/Decisions()` |
| `src/commands/status.ts` | `grimoire status <id>` — delegates to `getChangeStatus()` |
| `src/commands/archive.ts` | `grimoire archive <id>` — delegates to `archiveChange()` |
| `src/commands/trace.ts` | `grimoire trace <file>` — delegates to `traceFile()` |
| `src/commands/log.ts` | `grimoire log` — delegates to `generateLog()` |
| `src/commands/docs.ts` | `grimoire docs` — delegates to `generateDocs()` |
| `src/commands/diff.ts` | `grimoire diff <id>` — delegates to `diffChange()` |
| `src/commands/ci.ts` | `grimoire ci` — delegates to `runCi()` |

## Patterns

### Structure
Every command file looks the same:
```
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
All commands are registered in `src/cli/index.ts` via `program.addCommand()`. The CLI entry point is `bin/grimoire.js` which imports the compiled `dist/cli/index.js`.

### Adding a new command
1. Create `src/core/<name>.ts` with the business logic
2. Create `src/commands/<name>.ts` with the commander wrapper
3. Import and register in `src/cli/index.ts`
4. Export the core function from `src/index.ts`

## Where New Code Goes
- New commands → `src/commands/<name>.ts`
- Command logic → always in `src/core/`, never here
