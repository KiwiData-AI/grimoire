---
status: accepted
date: 2026-08-10
decision-makers: [Fred]
---

# STE response style replaces caveman mode

## Context and Problem Statement
Caveman mode (0013) cut tokens by dropping grammar: no articles, sentence fragments, invented labels. In practice this hurt comprehension — responses saved tokens but cost rereads and follow-up questions. Meanwhile the style directive lived only as static AGENTS.md text, which agents drift away from as context fills. How should grimoire enforce terse-but-clear responses? This decision supersedes 0013.

## Decision Drivers
- Compression must not cost comprehension: dropped articles and fragments caused misreads
- Static instruction text loses force over a long session; reinforcement must be per-turn
- AI slop phrases ("load-bearing", "it's not X, it's Y") waste tokens without informing
- One ruleset should serve Claude Code (plugin hooks) and other agents (AGENTS.md text)

## Considered Options
1. STE levels — ASD-STE100 grammar (`ste`) with caveman retained as an opt-in maximum-compression level, enforced by both an AGENTS.md directive and a Claude Code plugin
2. Keep caveman levels, add a banned-phrase list on top
3. Plugin-only enforcement, no static directive

## Decision Outcome
Chosen option: "STE levels", because ASD-STE100 cuts the same filler while keeping articles, complete sentences, and one name per thing — brevity without the comprehension tax. Config key `project.ste` (`off` | `ste` | `caveman`) replaces `project.caveman`; a v3 config migration maps old levels (none→off, lite→ste, full/ultra→caveman). The `ste@grimoire` plugin (`plugins/ste`, forked from JuliusBrussee/caveman) enforces the ruleset in Claude Code with a session-start injection plus per-turn reinforcement; the AGENTS.md directive covers agents without plugin support. `grimoire init`/`update` print the plugin install commands when `integrations.ste_plugin` is set, and the init prompt for it defaults to yes — unlike the old opt-in caveman prompt — because the plugin is grimoire's own recommended style enforcement, not a third-party add-on.

### Consequences
- Good: responses stay terse without dropping grammar; slop phrases are banned explicitly
- Good: per-turn plugin reinforcement survives context compression, where static text failed
- Good: single ruleset source (`plugins/ste/skills/ste/SKILL.md`) serves hook and directive
- Bad: two enforcement paths (plugin, directive) must stay consistent by hand
- Bad: downstream projects need one `grimoire update` run to migrate config keys

### Confirmation
If sessions with the plugin active stop producing banned scaffolding phrases while technical content stays complete, the decision is validated.
