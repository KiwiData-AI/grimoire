---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Use AGENTS.md as the universal LLM instruction file

## Context and Problem Statement
Grimoire must work with any AI coding agent, not just Claude Code. Each tool has its own config format (.cursorrules, copilot-instructions.md, .windsurfrules). We need one source of truth for workflow instructions.

## Decision Drivers
- AGENTS.md is an open standard supported by 60K+ repos
- Supported by Claude Code, Cursor, Copilot, Codex, Gemini CLI, Windsurf, Aider, Zed, Warp
- Claude Code skills are just thin wrappers — the real workflow lives in AGENTS.md
- Must coexist with other instructions in the same file

## Considered Options
1. AGENTS.md with managed block markers
2. Tool-specific config files for each supported agent
3. Custom .grimoire/instructions.md

## Decision Outcome
Chosen option: "AGENTS.md with managed block markers", because it is the emerging universal standard. Managed block markers (`<!-- GRIMOIRE:START/END -->`) let grimoire own its section while preserving user content.

### Consequences
- Good: Any LLM that reads AGENTS.md can follow the grimoire workflow
- Good: `grimoire update` can refresh the grimoire section without touching user content
- Good: Single file to maintain, not N tool-specific configs
- Bad: AGENTS.md is large; some tools may not read the full file effectively

### Confirmation
If a developer can run the grimoire workflow using Cursor, Codex, or Aider by reading AGENTS.md alone (without Claude Code skills), the decision is validated.
