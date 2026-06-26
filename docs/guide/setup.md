# Setup &amp; best practices

`grimoire init` detects your stack and writes config accordingly, so the fastest
path is to run it from a project root that already has its tooling in place.

## The short version

```bash
cd your-project
grimoire init          # interactive: pick agents, confirm detected tooling
```

Init auto-detects and records:

- **Language** — TypeScript, JavaScript, Python, Go
- **Package manager** — npm / pnpm / yarn, or uv / poetry / pipenv / pip
- **Lint** — ESLint / Biome, or Ruff / flake8
- **Format** — Prettier / Biome, or Black
- **Unit test** — Vitest / Jest, or pytest, or `go test`
- **BDD** — cucumber-js / playwright-bdd, or behave / pytest-bdd

Detection is best-effort. If your tooling isn't installed yet, install it
*first* so init records the right commands — otherwise fix them later in
`.grimoire/config.yml`.

## Pick your agents

```bash
grimoire init --agent claude --agent opencode   # skills to both dirs
grimoire init --agent codex                     # skills to .agents/skills
grimoire init --agent cursor                    # .cursor/rules/grimoire.mdc
```

Pass `--agent` per tool to skip the prompt. See
[Agent compatibility](/guide/compatibility) for what each tool gets.

## TypeScript project

Have your tooling configured before init so the detected commands are real:

```bash
# representative stack
pnpm add -D vitest @cucumber/cucumber eslint prettier
grimoire init --agent claude
```

Init should record commands like `npx vitest run` (unit), `npx cucumber-js`
(BDD), `npx eslint .` (lint), `npx prettier --check .` (format). Verify:

```bash
grimoire check       # runs the recorded gate against a change
```

Considerations:

- **Package manager matters.** A `pnpm-lock.yaml` / `yarn.lock` is detected and
  the package-manager command is recorded — but test/lint commands default to
  `npx`. If you run scripts through pnpm/yarn, adjust the commands in
  `.grimoire/config.yml` so the gate matches your real workflow.
- **BDD layer.** cucumber-js and playwright-bdd are detected from
  dependencies. If you keep behavior tests in Playwright, prefer
  `playwright-bdd` so `.feature` files map to real specs.
- **Biome users.** Biome covers both lint and format — init records it for both;
  don't also wire Prettier/ESLint unless you actually run them.

## Python project

```bash
# representative stack
uv add --dev pytest pytest-bdd ruff black
grimoire init --agent claude
```

Init should record `pytest` (unit), `pytest --bdd` or `behave features/` (BDD),
`ruff check .` (lint), `black --check .` (format).

Considerations:

- **uv / poetry / pip are all detected** from their lockfiles or pyproject
  sections — but confirm the recorded test command runs in your environment
  (e.g. `uv run pytest` vs bare `pytest`). Adjust in `.grimoire/config.yml`.
- **BDD choice.** `behave` (own `features/` runner) and `pytest-bdd` (rides
  pytest) are both detected. Pick one; pytest-bdd keeps a single test runner.
- **Docstring style.** Init detects `convention = "google"` / numpy / sphinx
  from `pyproject.toml` and records `comment_style` so doc-style checks match
  your house style. Set it explicitly if you have no pydocstyle config.

## After init

```bash
grimoire status      # what artifacts/tasks exist for a change
grimoire validate    # specs and artifacts are well-formed
grimoire trace       # commits trace back to requirements
grimoire update      # refresh AGENTS.md + skills to the latest version
```

Re-run `grimoire update` after upgrading the package to pull new skills and
instruction changes into your project.

> **Ask your agent.** Once init has run, `AGENTS.md` and the skills are loaded,
> so your AI assistant can answer setup questions directly — "what test command
> did grimoire record?", "how do I start a new change?", "why did check fail?".
> It reads the installed config; you don't have to dig through files.
