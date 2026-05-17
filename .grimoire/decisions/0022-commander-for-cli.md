---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Use commander.js for CLI argument parsing

## Context and Problem Statement
The grimoire CLI exposes ~17 subcommands with options, arguments, and a `--json` flag. We need a CLI parser library that handles subcommand registration, option parsing, help generation, and validation without us hand-rolling argv parsing.

## Decision Drivers
- First-class subcommand model (each grimoire command lives in its own file)
- Auto-generated `--help` output
- Async action handlers (most grimoire commands are async)
- Predictable, minimal API surface
- Mature and widely understood

## Considered Options
1. **commander.js** — long-standing, declarative, simple subcommand API
2. **yargs** — more configurable, more middleware features, larger surface
3. **clipanion** — class-based, type-safe, used by Yarn
4. **citty / cac** — newer minimal options
5. **Hand-roll** — parse `process.argv` ourselves

## Decision Outcome
Chosen option: **commander.js**, because its declarative `new Command(...)` API maps cleanly onto our one-file-per-command convention (see `src/commands/*.ts`), and the subcommand registration pattern in `src/cli/index.ts` is a small, scannable list. The library is mature (>15 years), depends on nothing, and contributors don't need to learn an unusual API.

### Consequences
- Good: Each command file follows an identical template; learning curve for new contributors is minutes, not hours.
- Good: `--help` and `--version` come for free.
- Good: Async action handlers are first-class.
- Good: Zero transitive dependencies.
- Bad: Type ergonomics for options aren't as strong as clipanion's class-based approach.
- Bad: Advanced features (middleware, prompting, hierarchical subcommands) are limited compared to yargs.

### Cost of Ownership
- **Maintenance burden**: One direct dep, very stable release cadence.
- **Ongoing benefits**: New commands are 10 lines of boilerplate; no decisions about parsing.
- **Sunset criteria**: Revisit if we need stronger typed-option ergonomics or if the API grows beyond what commander supports.

### Confirmation
Measurable signals:
- Every file under `src/commands/` exports a single `Command` instance and contains no business logic (verify via `grimoire map --symbols` or area-doc reuse audit)
- `package.json` `dependencies.commander` remains the only CLI parser dependency
- New command additions touch exactly three files: `src/core/<name>.ts`, `src/commands/<name>.ts`, `src/cli/index.ts`
