# Utils
> Last updated: 2026-05-17

## Purpose
Shared utilities used across core modules. Small, focused helpers for config loading, path resolution, filesystem, and process spawning.

## Boundaries
- Utils are imported by core modules and (indirectly) commands. They never import from core or commands.
- Utils are pure infrastructure — no grimoire-specific business logic.

## Key Files
| File | Responsibility |
|------|---------------|
| `src/utils/config.ts` | Load and parse `.grimoire/config.yaml` — returns typed `GrimoireConfig` with defaults; handles legacy flat format |
| `src/utils/paths.ts` | Project root detection (walk up to find `.grimoire/` or `features/`); path safety validation |
| `src/utils/fs.ts` | Filesystem helpers — `fileExists()`, `readFileOrNull()`, `escapeRegex()`, `findFiles()` |
| `src/utils/spawn.ts` | `spawnWithStdin()` — spawn a process with stdin piped (used for LLM invocations) |

## Reusable Code
Utilities here that MUST be reused (not re-implemented):

| Function/Class | Location | What It Does |
|----------------|----------|-------------|
| `loadConfig()` | `src/utils/config.ts` | Load `.grimoire/config.yaml` with full defaults — handles missing file, parse errors, legacy format |
| `findProjectRoot()` | `src/utils/paths.ts` | Walk up from cwd to find project root (`.grimoire/` or `features/`). Falls back to cwd. |
| `resolveChangePath()` | `src/utils/paths.ts` | Safely resolve a change ID to its directory path — validates against path traversal |
| `safePath()` | `src/utils/paths.ts` | Resolve a path and verify it stays within the project root |
| `fileExists()` | `src/utils/fs.ts` | Check if a path exists (file or directory). Use this instead of try/catch around `access()` |
| `readFileOrNull()` | `src/utils/fs.ts` | Read a file, returning null if it doesn't exist. Use instead of try/catch around `readFile()` |
| `escapeRegex()` | `src/utils/fs.ts` | Escape a string for use in a RegExp constructor |
| `findFiles()` | `src/utils/fs.ts` | Find files matching a glob extension pattern under a directory (via fast-glob) |
| `spawnWithStdin()` | `src/utils/spawn.ts` | Spawn a process with stdin piped — used for LLM/agent commands |

## Patterns

### Config types
`GrimoireConfig` is the central config type. Key interfaces:
- `ProjectConfig` — language, package_manager, commit_style, doc_tool, comment_style, surface
- `ToolConfig` — name, command, check_command, prompt (for LLM-based checks)
- `LlmConfig` — thinking agent + coding agent, each with command and optional model
- `BugTrackerConfig`, `McpServerConfig`, `TestingToolsConfig` — opt-in subsections

Parse helpers (`parseProject`, `parseLlm`, `parseMcpServer`, `parseBugTrackers`, `parseTestingTools`, `parseTools`, `str`) keep `loadConfig()` declarative — add new sub-parsers rather than inlining new fields.

### Defaults
`loadConfig()` returns a full `GrimoireConfig` even when the YAML file is missing or malformed. Every field has a sensible default. The default checks list includes all standard steps.

### Legacy format support
`loadConfig()` supports both the new nested format (`project.language`) and legacy flat format (`language` at root level). Handled transparently — callers always get the nested format.

### spawnWithStdin pattern
Used when shelling out to LLM CLIs (claude, codex, etc.) that read a prompt from stdin. Returns `{ stdout, stderr, code }`. Honors timeout and abort.

## Where New Code Goes
- New utility functions → add to the appropriate file in `src/utils/`
- New config fields → add to the interfaces in `src/utils/config.ts` and add a sub-parser; wire into `loadConfig()`
- Do NOT put grimoire workflow logic here — that belongs in `src/core/`
