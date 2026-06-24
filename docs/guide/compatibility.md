# Agent compatibility

Grimoire works with any AI coding assistant that reads [`AGENTS.md`](https://agents.md/).
How *much* of grimoire an agent gets depends on what that agent can load. There
are three support tiers.

## Support tiers

| Tier | Tools | What grimoire installs | What you get |
| --- | --- | --- | --- |
| **Skills** | Claude Code, OpenCode, Codex | `AGENTS.md` + invokable skills in the tool's skills dir | Full workflow: draft → plan → BDD → traced commits, plus `/grimoire-*` skills and hooks |
| **Derived rules** | Cursor, GitHub Copilot | `AGENTS.md` compiled to the tool's native rule file | Workflow *instructions* (principles, anti-loop, Gherkin/MADR) enforced as always-on rules |
| **AGENTS.md only** | Windsurf, Cline, Aider, Google Antigravity, others | `AGENTS.md` at repo root | Workflow *instructions* if the tool reads `AGENTS.md`; no generated file, no skills |

`grimoire init` installs skills to the correct path per tool:

| Tool | `--agent` flag | Install path |
| --- | --- | --- |
| Claude Code | `claude` | `.claude/skills/` (+ hooks via `.claude/hooks.json`) |
| OpenCode | `opencode` | `.opencode/skills/` (also reads `.claude/skills/` natively) |
| Codex (OpenAI) | `codex` | `.agents/skills/` |
| Cursor | `cursor` | `.cursor/rules/grimoire.mdc` (AGENTS.md derivative) |
| GitHub Copilot | `copilot` | `.github/copilot-instructions.md` (AGENTS.md derivative) |

## Limitations by tier

**Skills tier (Claude Code / OpenCode / Codex).** Full feature set. Skill
execution, hooks, and the codebase-memory-mcp graph features depend on each
tool's MCP and hook support — Claude Code has the deepest integration.

**Derived-rules tier (Cursor / Copilot).** No invokable skills, no hooks. The
discipline lives as always-on rules the agent reads, not as steps it executes.
You drive the workflow; the rules keep it honest.

**AGENTS.md-only tier (Windsurf, Cline, Aider, Antigravity, …).** No `--agent`
flag, no generated rule file, no skills, no hooks. These tools get grimoire's
engineering principles only, and only if they read `AGENTS.md`. Some tools
prefer their own native config path (e.g. Windsurf's `.windsurf/rules/`,
Antigravity's native rules) — point the tool at `AGENTS.md` manually (reference
or symlink) if it doesn't pick up the root file automatically.

## What "works" means

Two distinct things travel separately:

- **Discipline** (the engineering principles, anti-loop protocol, Gherkin/MADR
  workflow) — travels via `AGENTS.md`, so it reaches *any* tool that reads it.
- **Skill execution + hooks** (invokable `/grimoire-*` steps, enforced gates) —
  Claude Code, OpenCode, and Codex only.

If your tool isn't listed, it still works at the AGENTS.md tier as long as it
reads `AGENTS.md`. Want a tighter binding for an unsupported tool? It's a small
change to add a projection target — open an issue or PR.

> **Ask your agent.** Any grimoire-enabled agent has `AGENTS.md` loaded, so you
> can just ask it — "which grimoire skills do I have here?", "does this tool
> support hooks?" — and it will answer from the installed config.
