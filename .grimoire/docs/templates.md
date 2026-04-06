# Templates
> Last updated: 2026-04-05

## Purpose
Static files that get copied into the target project during `grimoire init`. These are the starting-point artifacts that users customize for their project.

## Boundaries
- Templates are plain text files with no executable logic.
- Copied by `src/core/init.ts` — the init module reads from `templates/` and writes to the target project.
- Map config files (`mapignore`, `mapkeys`) are also read at runtime by `src/core/map.ts` as fallback defaults.

## Key Files
| File | Responsibility |
|------|---------------|
| `templates/example.feature` | Sample Gherkin feature with 2FA login scenarios — copied as a starting example |
| `templates/manifest.md` | Template for change manifests — YAML frontmatter + required sections (Why, Feature Changes) |
| `templates/decision.md` | Template for MADR decision records — YAML frontmatter + required sections (Context, Options, Outcome) |
| `templates/mapignore` | Patterns to skip during `grimoire map` — similar to .gitignore (node_modules, dist, .venv, etc.) |
| `templates/mapkeys` | Key file definitions for type detection — format: `filename = type` (e.g., `package.json = node-package`) |

## Patterns

### Template destinations
| Template | Copied to |
|----------|-----------|
| `decision.md` | `.grimoire/decisions/template.md` |
| `mapignore` | `.grimoire/mapignore` |
| `mapkeys` | `.grimoire/mapkeys` |
| `example.feature` | Not currently copied (reference only) |
| `manifest.md` | Not copied during init — skills create manifests per-change |

### Non-destructive copying
Init checks `fileExists()` before copying each template. Existing files are never overwritten — the user gets an "exists" message instead.

## Where New Code Goes
- New template files → `templates/<name>`
- Copy logic → add to `src/core/init.ts` in the template-copying section
- Remember to add to `files` in `package.json` if it should be published
