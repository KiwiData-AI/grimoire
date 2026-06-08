# Contributing to Grimoire

## Architecture Overview

```
bin/grimoire.js          CLI entry point (loads dist/cli/index.js)
│
src/cli/index.ts         Registers all 15 commands with commander.js
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

### Repository layout: three trees, three jobs

Grimoire's repo has three trees that are easy to confuse:

- **`src/`** is the **CLI** — the compiled `grimoire` binary. It does the deterministic work skills can't: running checks, tracing git history, generating docs, validating artifacts.
- **`skills/`** is the **AI workflow definitions** — markdown (`SKILL.md`) that AI agents execute. Skills orchestrate the human-in-the-loop process and shell out to the `grimoire` CLI (`grimoire check`, `grimoire pr`, etc.) for the deterministic steps. **`skills/` is canonical** — it's what ships in the npm package (see `files` in `package.json`) and what `grimoire init`/`update` install into target projects.
- **`.grimoire/`** is **this repo's own dogfood data** — grimoire's decisions, area docs, constraints, and in-flight changes, produced by running grimoire *on itself*. It is not shipped; it's how we eat our own dog food.

`templates/` holds the scaffold files (`manifest.md`, `decision.md`, `constraints.md`, `example.feature`) that `grimoire init` copies into a new project. `features/` holds grimoire's own Gherkin specs — the behavioral contract for the CLI, the source of truth for what grimoire does.

> **`.claude/skills/` is generated, not canonical.** When you run grimoire on this repo (dogfooding), `grimoire update` installs a copy of `skills/` into `.claude/skills/` so Claude Code can load them locally. That directory is **git-ignored** — never edit it by hand and never commit it. Always edit `skills/`; regenerate the local copy with `grimoire update`.

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

**Codebase intelligence:** code structure (symbols, call graphs, reusable code) is read live from codebase-memory-mcp — grimoire does not store a snapshot. `docs.ts` generates intent-focused area docs and aggregates them into `OVERVIEW.md`.

**Quality:** `check.ts` runs the pre-commit pipeline (tool steps + LLM review steps). `test-quality.ts` detects weak assertions. `health.ts` scores the project across its metrics, including convention drift.

**Change management:** `validate.ts` checks Gherkin/MADR/manifest structure. `list.ts` and `status.ts` show active changes. Artifacts are edited live on the feature branch — there is no promote or archive step; git history is the record.

**Traceability:** `trace.ts` follows a file through git commits back to grimoire change IDs via the `Change:` trailer.

### Where things live

| You want to... | Look at |
|----------------|---------|
| Add a CLI command | `src/commands/` (wrapper) + `src/core/` (logic) + register in `src/cli/index.ts` + export from `src/index.ts` |
| Add a tool detector | `src/core/detect.ts` — add a function, add it to the `checks` array |
| Add a health metric | `src/core/health.ts` — add an async function, add to `Promise.all` |
| Add a skill | `skills/<name>/SKILL.md` + add to `SKILL_NAMES` in `src/core/shared-setup.ts` |
| Add a template | `templates/` + copy logic in `init.ts` + add to `files` in `package.json` |
| Add/change config | Interfaces in `src/utils/config.ts` + handle in `loadConfig()` |
| Understand the project | `features/` (behavioral specs), `.grimoire/docs/` (intent-focused area docs), or the codebase-memory-mcp graph (live structure) |

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

Grimoire has two test layers:

**Unit/integration (vitest)** — the primary surface. Tests live next to their modules (`src/core/detect.test.ts`) and own all the detail: flags, JSON shapes, error strings, edge cases. CLI command wrappers are excluded from coverage (they're thin).

```bash
npx vitest                    # Watch mode
npx vitest run                # Single run
npx vitest run --coverage     # With coverage report
```

**Behavioural (cucumber-js)** — black-box E2E over the built CLI. Each `features/*.feature` is a domain-language user journey; step definitions in `features/steps/` spawn the real `grimoire` binary in a throwaway project and assert on observable outcomes (output, exit code, files written).

```bash
npm run test:bdd              # builds, then runs cucumber (skips @manual)
```

Feature files are intentionally **few and domain-level**. A `.feature` earns its place only if it passes the admission test (external actor, observable, domain language, survives reimplementation) — it must NOT assert flag names, JSON keys, or exact output strings; that detail belongs in vitest. Journeys driven by an AI agent (draft, plan, review, apply, …) are tagged `@manual`: they're living documentation, not executed, because their outcome is the agent's behaviour, not a deterministic CLI result.

### Code style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **ESM** — all imports use `.js` extensions (TypeScript ESM convention)
- **Functional** — no classes in core modules. Export async functions.
- **chalk for output** — all human-readable output uses chalk. JSON output uses `console.log(JSON.stringify(...))`.
- **Errors at boundaries** — validate input in commands, trust internal calls in core

### Dependencies

Grimoire keeps its runtime dependencies deliberately small:
- `commander` — CLI framework
- `chalk` — terminal colors
- `yaml` — YAML parsing
- `fast-glob` — file globbing
- `gray-matter` — front-matter parsing for Gherkin/MADR/manifest files
- `simple-git` — git operations (trace, diff, branch checks)
- `@cucumber/gherkin`, `@cucumber/messages` — Gherkin parsing/validation

Adding a dependency needs a good reason. Prefer Node.js built-ins (`fs`, `path`, `child_process`).

## Project documentation

- **README.md** — User-facing docs (install, quick start, command reference)
- **AGENTS.md** — AI assistant instructions (bundled into target projects)
- **RESEARCH.md** — Design rationale, problem space research, competitive landscape
- **features/*.feature** — Behavioral specs in Gherkin (the source of truth for what grimoire does)
- **.grimoire/decisions/** — Architecture decisions in MADR format (why we made each choice)
- **.grimoire/docs/** — Intent-focused area docs (purpose, boundaries, conventions), data schema, and the `constraints.md` register; live code structure comes from codebase-memory-mcp

For the full picture of what grimoire does and why, read `features/` first, then `RESEARCH.md`, then the decision records.
