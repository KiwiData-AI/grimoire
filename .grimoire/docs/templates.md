# Templates
> Last updated: 2026-05-17

## Purpose
Static files copied into the target project during `grimoire init` (and refreshed by `grimoire update` where non-destructive). These are the starting-point artifacts users customize per project.

## Boundaries
- Templates are plain text/JSON/YAML with no executable logic.
- Copied by `installTemplates()` in `src/core/shared-setup.ts` — never read at runtime by grimoire itself except `mapignore`/`mapkeys`/`dupignore` which `src/core/map.ts` falls back to as defaults.
- Init checks `fileExists()` before copying each template — existing files are never overwritten.

## Key Files
| File | Responsibility / Destination |
|------|------------------------------|
| `templates/example.feature` | Sample Gherkin feature with 2FA login scenarios — reference only |
| `templates/manifest.md` | Template for change manifests — YAML frontmatter + required sections (Why, Feature Changes). Skills create per-change manifests from this. |
| `templates/decision.md` | Template for MADR decision records → `.grimoire/decisions/template.md` |
| `templates/mapignore` | Patterns skipped by `grimoire map` → `.grimoire/mapignore` |
| `templates/mapkeys` | Key file definitions (`filename = type`) → `.grimoire/mapkeys` |
| `templates/dupignore` | Patterns excluded from jscpd duplicate scan → `.grimoire/dupignore` |
| `templates/debt-exceptions.yml` | Allowlist of accepted tech-debt items → `.grimoire/debt-exceptions.yml` |
| `templates/context.yml` | Project deployment + infra context scaffold → `.grimoire/docs/context.yml` |
| `templates/brand-tokens-example.json` | DTCG-format brand token example for the design skill |
| `templates/brand-voice-example.md` | Brand voice/tone reference for the design skill |
| `templates/design-tool-setup-stub.md` | Stub doc written when no design tool MCP is configured |

## Patterns

### Template destinations
| Template | Copied to |
|----------|-----------|
| `decision.md` | `.grimoire/decisions/template.md` |
| `mapignore`, `mapkeys`, `dupignore` | `.grimoire/` (root) |
| `debt-exceptions.yml` | `.grimoire/debt-exceptions.yml` |
| `context.yml` | `.grimoire/docs/context.yml` |
| `brand-tokens-example.json`, `brand-voice-example.md` | `.grimoire/brand/` (when user opts in during init) |
| `example.feature`, `manifest.md`, `design-tool-setup-stub.md` | Not directly copied — referenced by skills |

### Non-destructive copying
Init checks `fileExists()` before copying each template. Existing files are never overwritten — the user gets an "exists" message instead.

### Publishing
All files in `templates/` are published to npm via the `files` array in `package.json`.

## Where New Code Goes
- New template files → `templates/<name>`
- Copy logic → add to `installTemplates()` in `src/core/shared-setup.ts`
- Remember the `files` array in `package.json` already includes `templates/` — new files ship automatically
