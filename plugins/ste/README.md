# ste

Brevity with clarity. A response-style plugin based on ASD-STE100 (Simplified
Technical English): cut filler, hedging, and rhetorical scaffolding — keep
articles, complete sentences, and one name per thing.

Fork of [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee (MIT).
What changed from upstream:

- New default level `ste`: keeps ASD-STE100 grammar (articles, complete sentences,
  ~20-word sentences, one fact per sentence, consistent naming, no invented labels).
- Banned-scaffolding list: AI-isms that add emphasis without information
  ("honestly", "load-bearing", "it's not X, it's Y", "the key insight", ...).
- Levels reduced to `off | ste | caveman`. `caveman` is upstream's `full` —
  maximum compression for when comprehension matters less.
- Wenyan levels, compress/commit/review skills, and the statusline setup nudge
  removed.

## Levels

| Level | Behavior |
|-------|----------|
| `ste` (default) | Delete noise, keep grammar. Technical-manual voice |
| `caveman` | Also drop articles, allow fragments. Max compression |
| `off` | No style injection |

Switch in-session: `/ste caveman`, `/ste off`, `/ste` (back to default).
Deactivate: "stop ste" or "normal mode".

## Default mode

Resolution order: `STE_DEFAULT_MODE` env var → `~/.config/ste/config.json`
(`{"defaultMode": "ste"}`) → `ste`.

## Beyond Claude Code

`AGENTS.md` in this directory links to the ruleset (`skills/ste/SKILL.md`), so
any agent that reads AGENTS.md — Codex, Gemini CLI, Cursor — picks up the same
style without the hook machinery.

## Statusline (optional)

```json
"statusLine": { "type": "command", "command": "bash \"<plugin-root>/hooks/ste-statusline.sh\"" }
```

Shows `[STE]` or `[STE:CAVEMAN]`.
