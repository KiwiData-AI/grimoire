---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Skills are pure markdown instructions, not executable code

## Context and Problem Statement
Grimoire needs to define AI workflows (draft, plan, review, apply, verify, etc.) that guide coding agents through structured processes. Should these workflows be executable code (plugins, DSL) or natural language instructions?

## Decision Drivers
- Must work with any AI coding agent that reads markdown (Claude Code, Cursor, Codex, Windsurf, Cline, Aider)
- No runtime dependencies — skills shouldn't require a running grimoire process
- Easy to read, audit, and modify by users
- Must support Claude Code's skill system (`.claude/skills/` with SKILL.md files)

## Considered Options
1. Pure markdown — SKILL.md files with trigger conditions, prerequisites, workflow steps, and rules
2. Plugin system — TypeScript modules with a defined API that grimoire executes
3. DSL — a custom workflow language compiled to agent instructions
4. Executable skills — markdown with embedded code blocks that get executed

## Decision Outcome
Chosen option: "Pure markdown", because it works with every AI agent that reads files, requires no runtime, and is trivially auditable. Skills are installed as `.claude/skills/grimoire-*/SKILL.md` and referenced in AGENTS.md for non-Claude agents. The AI interprets the instructions — grimoire doesn't execute them.

### Consequences
- Good: Zero runtime dependency — skills work even if grimoire CLI isn't installed
- Good: Any AI agent can follow the instructions (not locked to Claude Code)
- Good: Users can read, customize, and override skill behavior directly
- Good: No security surface from executing plugin code
- Bad: No programmatic enforcement — the AI may deviate from instructions
- Bad: Can't unit test skill behavior (instructions, not code)
- Bad: Skill updates require file replacement, not API versioning

### Confirmation
If the same skill instructions produce consistent workflow behavior across Claude Code and at least one other agent (via AGENTS.md), the decision is validated.
