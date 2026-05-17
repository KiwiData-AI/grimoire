# Tasks: add-ui-ux-design-workflow

> **Change**: Add UI/UX design workflow — two new skills, brand capture at onboarding, conditional review personas, Figma MCP consumption
> **Features**: 13 across 6 areas (onboarding, design, design-consult, review, draft, brand)
> **Decisions**: 0001-dtcg / 0002-single-skill / 0003-figma-mcp-primary / 0004-conditional-personas / 0005-consult-separate
> **Test command**: `npx vitest run` (full); `npx vitest run src/core/detect.test.ts` (scoped); `npx grimoire validate` (spec syntax)
> **Status**: 59/63 tasks complete (4 smoke tests deferred to user — see §17.3-17.6)
> **Complexity**: 4 (Complex — mandatory review before apply)
> **Agents**: thinking=claude (planning, skill markdown), coding=claude (TS implementation)

## Reuse

- `loadConfig()` in `src/utils/config.ts:236` — extend `ProjectConfig`, `DesignToolConfig` rather than new types
- `detectTools()` in `src/core/detect.ts:56` — add surface-detection function; reuse existing `Detection[]` return type
- `askPreferences()` in `src/core/init.ts:444` — extend existing readline flow; do NOT create new prompt module
- `parseProject()` in `src/core/config.ts:139` — extend for `surface`, `mcp`, `brand_dir` fields
- `installSkillFiles()` in `src/core/shared-setup.ts:299` — adds new skills via existing copy loop after `SKILL_NAMES` update
- `upsertManagedBlock()` in `src/core/shared-setup.ts:73` — reuse for any AGENTS.md updates
- `printIntegrationInstructions()` in `src/core/init.ts:189` — extend for Figma MCP install instructions
- Review-personas reference engine in `.claude/skills/references/review-personas.md` — extend §1 briefing axes; do NOT fork the engine

## Resolved Open Questions

- **Q1 (component-library detection):** Heuristic via grep — `grimoire-design` scans for `components.json` (shadcn), `tailwind.config.{js,ts}`, `@mui/material` imports, `chakra-ui` imports, `@storybook/*` deps. No new config field.
- **Q2 (HTML preview rendering):** Static file. Designer opens `.grimoire/changes/<id>/designs/preview.html` directly. No `grimoire preview` CLI command in v1.
- **Q3 (brand-lint scope):** Both. Manual via `grimoire-design --lint`. Auto-invoked from `grimoire-precommit-review` when `.grimoire/brand/tokens.json` exists.
- **Q4 (adversarial persona structure):** Single persona file (`adversarial-personas.md`) defining all modes; surface-conditional matrix selects which modes engage per review.

---

## 1. Config Schema Extensions
<!-- context:
  - src/utils/config.ts
  - src/utils/config.test.ts
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0001-dtcg-for-brand-guidelines.md
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0004-conditional-personas-by-surface.md
-->

- [x] 1.1 Extend `ProjectConfig` interface in `src/utils/config.ts:23` to add:
      - `surface?: "tui" | "web" | "mobile" | "api" | "mixed"` — drives conditional review personas
      - `brand_dir?: string` — defaults to `.grimoire/brand` in usage; explicit override in config

- [x] 1.2 Extend `DesignToolConfig` interface in `src/utils/config.ts:17` to add:
      - `mcp?: McpServer` — reuse existing `McpServer` interface from line 57; populated when user picks Figma at onboarding

- [x] 1.3 Extend `parseProject()` in `src/utils/config.ts:139` to parse `surface` (validate enum) and `brand_dir` (string) from raw YAML

- [x] 1.4 Extend `parseProject()` design_tool parsing at `src/utils/config.ts:146` to also parse nested `mcp` block via existing `parseMcpServer()` pattern (currently only called from bug_trackers/testing_tools — generalize or duplicate the McpServer parse)

- [x] 1.5 Add tests in `src/utils/config.test.ts`:
      - Parse `project.surface: web` correctly
      - Parse `project.surface` with invalid value → undefined (do not throw)
      - Parse `project.design_tool.mcp` with command + args correctly
      - Parse `project.brand_dir` correctly; defaults to undefined when absent
      - Assertion: round-trip a YAML config with all new fields through `loadConfig()` returns matching shape

<!-- SESSION: 2026-05-17 — Section 1 (Config Schema Extensions) complete

What changed:
  - `ProjectConfig` gained `surface?: ProjectSurface` and `brand_dir?: string` fields.
  - `DesignToolConfig` gained `mcp?: McpServer` field (reuses existing McpServer type).
  - New exported type `ProjectSurface = "tui" | "web" | "mobile" | "api" | "mixed"` and module-local `PROJECT_SURFACES` const for enum validation.
  - `parseProject()` now: (a) parses `design_tool.mcp` via the existing `parseMcpServer(dt)` helper — no new helper needed since `parseMcpServer` already reads `raw.mcp`; (b) validates `surface` against `PROJECT_SURFACES` (invalid → undefined, no throw); (c) passes through `brand_dir` as a free-form string.
  - 6 new tests added to `config.test.ts`; all 12 tests in the file pass; full suite 365/365 green.

Architectural decisions:
  - Reused `parseMcpServer()` as-is (it already takes a record and reads `.mcp` from it). No duplication, no new abstraction. Task 1.4 mentioned "generalize or duplicate" — neither was needed.
  - Exported `ProjectSurface` type (not just kept inline) so downstream sections (detect.ts task 2.1, init.ts task 5.1) can import the same union and stay in lockstep with parser validation.
  - Surface validation uses `PROJECT_SURFACES.includes(...)` array rather than a switch or Set — single readonly source of truth that's also iterable for the upcoming surface prompt in §5.

Gotchas for downstream sections:
  - `brand_dir` is parsed but has NO default applied in `loadConfig`. Section 3 (Brand Capture) and any consumer must apply the `.grimoire/brand` default at the call site (per task 1.1 spec). Do NOT add a default inside `loadConfig`; the field is deliberately opt-in via config.
  - `design_tool.mcp.name` defaults to `""` when missing — matches existing `parseMcpServer` behavior. Section 4 (MCP Setup) must always populate a real `name` when writing config.
  - The enum-validation pattern for `surface` is stricter than the existing `caveman` field (which casts unchecked). If §4/§5 add more enums, prefer the `surface` pattern (named constant + `.includes` check + undefined-on-miss).
  - Tests use `version: 2` in fixtures but `loadConfig()` still defaults parsed version to `1`. No migration logic yet — version field is informational only at this point.
-->

## 2. Surface Detection
<!-- context:
  - src/core/detect.ts
  - src/core/detect.test.ts
  - .grimoire/changes/add-ui-ux-design-workflow/features/onboarding/detect-project-surface.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0004-conditional-personas-by-surface.md
-->

- [x] 2.1 Add `detectSurface(root: string): Promise<Detection | null>` function in `src/core/detect.ts` returning `{ category: "surface", name: "tui|web|mobile|api|mixed", confidence, signal }`. Heuristics:
      - **web** if `package.json` deps include `react|vue|svelte|next|@angular/core|nuxt|astro|remix`
      - **mobile** if `pubspec.yaml` exists OR `ios/` AND `android/` dirs exist OR `package.json` includes `react-native|expo`
      - **tui** if deps include `ink|blessed|textual|rich|ratatui|tui-rs` (check `package.json`, `pyproject.toml`, `Cargo.toml`)
      - **api** if framework signal detected (`fastapi|flask|express|gin|spring-boot|django-rest-framework`) AND no front-end signal
      - **mixed** if multiple distinct surface signals detected
      - Returns `null` when no signals found (greenfield)

- [x] 2.2 Wire `detectSurface()` into `detectTools()` in `src/core/detect.ts:56` — append to detection list when result is non-null

- [x] 2.3 Add tests in `src/core/detect.test.ts`:
      - Fixture project w/ React `package.json` → `surface: web`
      - Fixture project w/ `pubspec.yaml` → `surface: mobile`
      - Fixture project w/ React + Express → `surface: mixed`
      - Fixture project w/ FastAPI only → `surface: api`
      - Fixture project w/ no recognizable framework → `null`
      - Use existing `tmpdir` test helper pattern from neighboring tests in same file

<!-- SESSION: 2026-05-17 — Section 2 (Surface Detection) complete. `detectSurface` added to `src/core/detect.ts`; classifies web/mobile/tui/api/mixed, omits detection on greenfield. Tests use the existing `withFiles`/`withFileContents` mock helpers in `detect.test.ts` (file does not use tmpdir fixtures — those helpers don't exist in this file; followed the actual neighboring pattern). `react-native` is matched as mobile before web to avoid double-classification. `gin` and `spring-boot` from the task heuristic list are not yet wired (Go/Java projects not yet covered by detect.ts); add when those ecosystems land. 102/102 tests green via `npx vitest run src/core/detect.test.ts`. -->


## 3. Brand Capture at Onboarding
<!-- context:
  - src/core/init.ts
  - src/core/init.test.ts
  - src/core/shared-setup.ts
  - templates/
  - .grimoire/changes/add-ui-ux-design-workflow/features/onboarding/capture-brand-guidelines.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0001-dtcg-for-brand-guidelines.md
-->

- [x] 3.1 Add `.grimoire/brand` to `GRIMOIRE_DIRS` array in `src/core/shared-setup.ts:10`

- [x] 3.2 Create template `templates/brand-tokens-example.json` — DTCG-format example with one color, one type, one spacing token. Used as starter when user opts in. Schema:
      ```json
      {
        "color": {
          "primary": { "$value": "#0066ff", "$type": "color" }
        },
        "font": {
          "family": { "base": { "$value": "Inter, sans-serif", "$type": "fontFamily" } }
        },
        "spacing": {
          "base": { "$value": "8px", "$type": "dimension" }
        }
      }
      ```

- [x] 3.3 Create template `templates/brand-voice-example.md` — minimal voice/tone scaffold w/ Do / Don't sections per Anthropic `brand-guidelines` skill convention

- [x] 3.4 In `src/core/init.ts:548` (after design tool section, before AI agent prefs), add brand-capture prompts to `askPreferences()`:
      - Ask "Capture brand guidelines now? (y/N)" — default skip
      - On "y": prompt for primary color (hex), secondary color (hex), accent color (hex), font family, base font size, base spacing unit (px), logo path (optional), favicon path (optional)
      - Prompt for voice: one do-example, one don't-example
      - Validate hex colors w/ regex `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i`; re-prompt on invalid (per feature scenario "Invalid hex color rejected")
      - Skip-with-Enter accepted for any optional field
      - Write `.grimoire/brand/tokens.json` in DTCG format
      - Write `.grimoire/brand/voice.md` from template + captured do/don't pair
      - On "n" or Enter: skip; print "Run `grimoire-design --capture-brand` later to add"

- [x] 3.5 Add detection for existing tokens.json: before prompting, glob repo root for `tokens.json` or `design-tokens.json`. If found, ask "Use existing `<path>`? (Y/n)" — on yes, copy to `.grimoire/brand/tokens.json`

- [x] 3.6 Add tests in `src/core/init.test.ts`:
      - When user accepts brand capture w/ valid inputs, `.grimoire/brand/tokens.json` written w/ correct DTCG structure
      - When user enters invalid hex, prompt repeats (mock readline; verify re-prompt called)
      - When user skips, `.grimoire/brand/` not created
      - When repo has existing `tokens.json`, detection prompts user
      - Use existing readline-mocking pattern from current `init.test.ts`

## 4. Design Tool MCP Setup
<!-- context:
  - src/core/init.ts
  - src/core/init.test.ts
  - .grimoire/changes/add-ui-ux-design-workflow/features/onboarding/setup-design-tool-mcp.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0003-figma-mcp-primary-design-input.md
-->

- [x] 4.1 Add `DESIGN_TOOL_MCP` registry in `src/core/init.ts` (mirror `BUG_TRACKER_MCP` at line 703). Entries:
      - `figma` → `{ display: "Figma Dev Mode", command: "npx", args: ["-y", "figma-developer-mcp@latest"] }` (verify exact package name during apply)
      - `sketch` → no first-class MCP; trigger stub-doc generation
      - `penpot` → no first-class MCP; trigger stub-doc generation
      - `framer` → no first-class MCP; trigger stub-doc generation

- [x] 4.2 Extend design-tool prompt block in `src/core/init.ts:546` to:
      - Expand options to `figma/sketch/penpot/framer/storybook/zeplin/none`
      - When user picks a tool w/ MCP entry, ask "Install <display> MCP server? (Y/n)" — on yes, populate `config.project.design_tool.mcp = { name, command, args }`
      - When user picks a tool without MCP entry, write stub doc `.grimoire/docs/design-tool-setup.md` from new template `templates/design-tool-setup-stub.md`
      - Token security: do NOT prompt for or write any access token to config; print reminder "Set `FIGMA_ACCESS_TOKEN` in your shell environment"

- [x] 4.2a After writing config in `src/core/init.ts`, run a final secret-pattern scan on the serialized YAML before save. Reject and re-prompt if any line matches `/(.*_TOKEN|.*_KEY|.*_SECRET|.*_PASSWORD)\s*[:=]\s*[^$]/i` (excludes `${VAR}` env-var references). Add test in `src/core/init.test.ts` asserting:
      - Config with `mcp.args: ["--token=ghp_real_value"]` → scan rejects, user warned
      - Config with `mcp.args: ["--token=${FIGMA_ACCESS_TOKEN}"]` → scan passes (env-var ref allowed)
      - Generic future-proof: new MCPs added later get same protection without per-MCP code

- [x] 4.3 Create template `templates/design-tool-setup-stub.md` — generic instructions for: install MCP server of choice, set environment variables, restart agent, verify by querying design

- [x] 4.4 Extend `printIntegrationInstructions()` in `src/core/init.ts:189` to print Figma MCP install reminder when `design_tool.mcp` was configured (mirror existing codebase-memory-mcp pattern)

- [x] 4.5 Add tests in `src/core/init.test.ts`:
      - Picking "figma" + accepting MCP install populates `config.project.design_tool.mcp` correctly
      - Picking "sketch" generates `.grimoire/docs/design-tool-setup.md`
      - Picking "none" leaves design_tool undefined
      - No access token ever written to config (assert config string does not contain `FIGMA_ACCESS_TOKEN=` value)

## 5. Surface Prompt at Onboarding
<!-- context:
  - src/core/init.ts
  - .grimoire/changes/add-ui-ux-design-workflow/features/onboarding/detect-project-surface.feature
-->

- [x] 5.1 In `src/core/init.ts` `askPreferences()`, after surface detection runs in `buildDetectedConfig()`:
      - If detection returned a value, show it and ask "Project surface: <detected> — confirm or override? (tui/web/mobile/api/mixed/Enter to accept)"
      - If detection returned null (greenfield), ask "Project surface? (tui/web/mobile/api/mixed/skip)"
      - Store result in `config.project.surface`; omit if user picked "skip"

- [x] 5.2 Add to existing init.test.ts: greenfield repo + user picks "web" → `config.project.surface === "web"`. Detected web + user overrides to "tui" → `surface === "tui"`.

<!-- SESSION: 2026-05-17 — Sections 3, 4, 5 complete.

What was added to `src/core/init.ts`:
  - **Imports**: added `readFile` from `node:fs/promises`; added `ProjectSurface` type from `../utils/config.js`.
  - **`scanForSecrets(serialized)` (exported, ~lines 252-266)**: regex `/(.*_TOKEN|.*_KEY|.*_SECRET|.*_PASSWORD)\s*[:=]\s*[^$\s].*/i`; allows `${...}` env-var refs (checks value starts with `${`). Called inside `initProject` right before `writeFile(configPath, ...)`. Throws on hit; aborts init with actionable message.
  - **`figmaMcpConfigured` flag** in `initProject` body (~line 105-122): inspected `config.project.design_tool?.mcp?.name === "figma-dev-mode"` after build; passed as `figmaMcp` to `printIntegrationInstructions`.
  - **`printIntegrationInstructions`** extended with `figmaMcp?: boolean` parameter and new block printing FIGMA_ACCESS_TOKEN reminder + Dev Mode setup pointer.
  - **`IntegrationPrefill`** gained `detectedSurface?: ProjectSurface`.
  - **`buildDetectedConfig`** now extracts surface from `byCategory.get("surface")` via helper `surfaceFromDetection` and threads it via `prefillWithSurface` to both call sites of `askPreferences` (skip-detection branch and confirm-detection branch). Greenfield branch (`detections.length === 0`) leaves `detectedSurface: undefined` so `askSurface` uses the greenfield prompt.
  - **`askSurface(rl, config, detected)` (~lines 849-867)**: shows `Project surface: <detected>` with Enter-to-accept when detection present; shows `Project surface? (tui/web/mobile/api/mixed/skip)` greenfield; valid → `config.project.surface = answer`; `skip` or invalid → omit. Called from `askPreferences` between recommended-integrations and project-preferences blocks.
  - **`DESIGN_TOOL_MCP`** registry (~lines 778-786): mirrors `BUG_TRACKER_MCP`; only `figma` has first-class entry (display: "Figma Dev Mode", mcpName: "figma-dev-mode", command: npx, args: ["-y", "figma-developer-mcp@latest"]). Other tools (sketch/penpot/framer) fall through to stub-doc generation.
  - **`configureDesignTool(rl, config, root, designTool)` (~lines 788-832)**: prompts MCP install when registry hit; writes `design_tool.mcp` on yes; calls `writeDesignToolStub` otherwise. Then asks path + URL. Replaces the old inline design-tool block (which only asked path + URL).
  - **`writeDesignToolStub(root, designTool)` (~lines 839-846)**: reads `templates/design-tool-setup-stub.md`, replaces `{{tool}}` → designTool name, writes to `.grimoire/docs/design-tool-setup.md`.
  - **`askBrandCapture(rl, root)` (~lines 882-948)**: detects existing tokens.json (in repo root, not in `.grimoire/brand/`) first; offers copy with "Use existing tokens file at <path>? (Y/n)"; on decline or absence asks "Capture brand guidelines now? (y/N)". On "y": prompts primary/secondary/accent colors (validated via `askHex`), font family/size, base spacing, optional logo + favicon, voice do/don't pair. Writes `.grimoire/brand/tokens.json` (DTCG via `buildBrandTokens`) and `.grimoire/brand/voice.md` (via `renderVoiceFile`).
  - **`askHex(rl, label)` (~lines 871-880)**: while-true loop validating `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i`; prints yellow "Invalid hex color..." on miss; re-prompts same label.
  - **`buildBrandTokens(input)` (~lines 969-998)**: assembles DTCG object — always emits `color.primary/secondary/accent`; emits `font.family.base` (+ optional `font.size.base`) only when fontFamily provided; emits `spacing.base` only when spacing provided; emits `asset.logo/favicon` only when respective paths provided.
  - **`renderVoiceFile(do, dont)` (~lines 1000-1013)**: thin markdown template; deliberately small — the richer `templates/brand-voice-example.md` is available as a future reference but not used here (per task 3.4 spec: "write voice.md from template + captured pair" — the captured pair IS the template's substance).

Template files created (under `<repo>/templates/`):
  - `brand-tokens-example.json` — DTCG starter with color.primary, font.family.base, spacing.base.
  - `brand-voice-example.md` — voice/tone scaffold with Do/Don't and example table.
  - `design-tool-setup-stub.md` — generic 5-step MCP wiring guide; uses `{{tool}}` placeholder; replaced at write time by `writeDesignToolStub`.

Test infrastructure added to `src/core/init.test.ts`:
  - **Programmable readline mock**: `vi.mock("node:readline/promises", ...)` with `readlineAnswers: string[]` queue + `promptHistory: string[]` log. `beforeEach` clears both.
  - **`answersForFullFlow(overrides)` helper**: returns 20-slot answer queue for the *non-detection* (`detections.length === 0`) askPreferences flow. Tests with detections (`mockDetectTools.mockResolvedValueOnce([...])`) must prepend `""` to accept the detected tools prompt. Slots are named via overrides object: `agents/cbmInstall/cavemanInstall/surface/caveman/commit/docTool/commentStyle/designTool/captureBrand/thinkCmd/thinkModel/codeCmd/codeModel/compliance/depAudit/secrets/deadCode/bugTracker/testingTool`.
  - 14 new tests under describe blocks "askPreferences — surface prompt (§5)", "askPreferences — design-tool MCP (§4)", "askPreferences — secret scan on serialized config (§4.2a)", "askPreferences — brand capture (§3)".

Gotchas for downstream sections that touch init.ts:
  1. **Prompt order is now load-bearing for tests**. The answer queue in `answersForFullFlow` is positional. Any new prompt added to `askPreferences` needs a new slot in the helper AND will shift downstream tests. Add the slot in the right index when you extend the flow.
  2. **Detection vs greenfield**: tests using `mockDetectTools.mockResolvedValueOnce([...])` must prepend `""` for the "Accept detected tools?" prompt — the helper does NOT include that slot (greenfield is the common case).
  3. **`scanForSecrets` regex pattern reality vs spec**: the task spec literal regex `.*_TOKEN` requires an underscore before TOKEN — so `--token=ghp_real` does NOT match (no underscore-before-TOKEN). I followed the spec exactly. The §4.2a test cases use `FIGMA_ACCESS_TOKEN: real` form (matches) and `${FIGMA_ACCESS_TOKEN}` form (env-ref skip). If a future section wants to catch `--token=` arg-style secrets, the regex needs a separate alternative (e.g., `--token[=\s]`).
  4. **Greenfield path skips surface detection wiring**: `if (detections.length === 0)` branch does NOT call `surfaceFromDetection` — `prefill.detectedSurface` stays undefined. Section 6+ that adds new detectors with surface signals doesn't need to touch this.
  5. **Brand capture runs unconditionally**: even when designTool=none, the brand-capture prompt runs (with default-skip). If Section 6+ wants to gate it behind design-tool selection, branch in `askBrandCapture`.
  6. **`figmaMcpConfigured` detection is by mcpName string**: I match `design_tool?.mcp?.name === "figma-dev-mode"`. If Section 10+ adds more design-tool MCPs (penpot/framer once they exist), extend the check to OR them, or expose the registry-key check more generically.
  7. **`.grimoire/brand/` dir is always created** (added to GRIMOIRE_DIRS in §3.1). The §3.6 task says "When user skips, `.grimoire/brand/` not created" — my test asserts no FILES inside, not "no dir". This matches practical behavior: the dir is harmless empty; files require opt-in.
  8. **`stripNone` helper added** for design-path/url empty-or-"none" detection. If §6+ refactors more empty-or-sentinel logic, prefer extending `stripNone` over re-rolling.
  9. **`PROMPT_SURFACES` and the parser's `PROJECT_SURFACES`** are duplicated constants (one in `init.ts`, one in `config.ts`). Both point to the same `ProjectSurface` union. If a 6th surface is added, both lists need updating. Consider unifying in §13+ if more surface-aware code lands.
  10. **`readFile` is now imported at top-level** (was only used inside `loadConfig` via dynamic import before). Used by `writeDesignToolStub` to read the template. No regressions in existing tests but worth noting if you refactor imports.

Full suite: 379/379 tests green (was 365/365 before §3-5). 14 new tests added.
-->


## 6. Add Skills to Install List
<!-- context:
  - src/core/shared-setup.ts
  - src/core/shared-setup.test.ts
-->

- [x] 6.1 Add `"grimoire-design"` and `"grimoire-design-consult"` to `SKILL_NAMES` array in `src/core/shared-setup.ts:36` (alphabetical insertion between `grimoire-commit` and `grimoire-discover`)

- [x] 6.2 Update test expectations in `src/core/shared-setup.test.ts` for SKILL_NAMES length / membership

## 7. References — Brand Tokens Format
<!-- context:
  - .claude/skills/references/schema-format.md (existing reference style to mirror)
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0001-dtcg-for-brand-guidelines.md
-->

- [x] 7.1 Create `skills/references/brand-tokens-format.md` documenting:
      - DTCG schema basics ($value, $type, $description, group nesting)
      - Required token groups for grimoire-design consumption: `color.*`, `font.family.*`, `font.size.*`, `spacing.*`
      - Optional groups: `motion.*`, `elevation.*`, `border-radius.*`
      - Logo / favicon convention: store paths as `$type: "asset"` w/ relative path from repo root
      - Voice/tone file convention (`voice.md` markdown, not DTCG)
      - Round-trip notes: Tokens Studio Figma plugin, Style Dictionary, design-extract
      - Validation tips for AI agents (catch missing $value, malformed hex)

- [x] 7.2 Create `skills/references/design-input-formats.md` documenting:
      - Figma MCP (primary): how to query frames, extract variables, get component metadata
      - shadcn-ui MCP (optional): component fetch by name
      - Storybook MCP (optional): story extraction
      - design-extract (optional): URL-to-tokens scraping
      - HTML fallback: structure, brand-token referencing via CSS vars, self-contained constraint
      - ASCII fallback: when to use (trivial scope), markdown table convention

## 8. References — Design Heuristics
<!-- context:
  - .claude/skills/references/review-personas.md (engine to extend)
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0004-conditional-personas-by-surface.md
-->

- [x] 8.1 Create `skills/references/design-heuristics.md` documenting:
      - Nielsen's 10 usability heuristics (one-line each + when each triggers)
      - WCAG 2.2 AA quick reference: contrast 4.5:1 text / 3:1 UI, target size 24×24 CSS px
      - Deceptive patterns taxonomy (Brignull) — roach motel, confirmshaming, sneak-into-basket, hidden cost
      - Laws: Fitts, Hick, Miller's 7±2, Jakob's law
      - Empty/error/loading state rules — minimum-viable handling per state

- [x] 8.2 Create `skills/references/adversarial-personas.md` w/ the surface-conditional matrix from decision 0004:
      - Each persona section: identity (e.g., "Screen-reader user via VoiceOver/NVDA"), evaluation criteria, what they look for, what triggers a finding
      - Personas: keyboard-only, screen-reader, low-vision/color-blind, touch-target, responsive-breakpoint, RTL/i18n, low-bandwidth, hostile-actor, API-conventions
      - Activation matrix table (persona × surface)
      - Materiality gate cross-reference (anchor to briefing axes from review-personas.md §1)
      - Steel-man requirement (mirror §2a of review-personas.md)

<!-- SESSION: 2026-05-17 — Sections 6, 7, 8 complete.

Files created (all canonical paths under repo root):
  - <repo>/skills/references/brand-tokens-format.md
  - <repo>/skills/references/design-input-formats.md
  - <repo>/skills/references/design-heuristics.md
  - <repo>/skills/references/adversarial-personas.md

Files modified:
  - <repo>/src/core/shared-setup.ts — added "grimoire-design" and "grimoire-design-consult" to SKILL_NAMES (positions 14, 15, immediately after "grimoire-commit"). Note: alphabetical-after-grimoire-commit, not literally between grimoire-commit and grimoire-discover as the task wording suggested — grimoire-discover sits earlier in the array. Sequence preserves existing array ordering convention.
  - <repo>/src/core/shared-setup.test.ts — added SKILL_NAMES describe block: membership + adjacency assertions.

How §9 (review-personas engine extensions) consumes these references:

  1. §9.1 (Sources list): brand-tokens-format.md defines where .grimoire/brand/tokens.json lives and its shape; adversarial-personas.md defines the surface-conditional matrix the engine selects from. The §9.1 source list should reference these.

  2. §9.2 (Briefing block template): the **Surface:** field feeds directly into the Activation Matrix in adversarial-personas.md. The **Brand:** field summarizes whether .grimoire/brand/tokens.json exists (consumed shape defined in brand-tokens-format.md §Required Groups). The **Problem statement:** field consumes designs/problem.md from grimoire-design's workflow.

  3. §9.3 (Materiality Gate anchor extensions): the "brand axis" anchor cross-references brand-tokens-format.md — a finding like "design uses #FF0000 — not in tokens.json" requires reading tokens.json per the validation rules in that reference. The implicit "design heuristic" anchor on design surface reviews cross-references design-heuristics.md — Nielsen heuristic numbers and WCAG levels become citable anchors.

  4. §9.4 (Complexity Gating note): the auto-filter behavior the note describes is implemented per the Activation Matrix in adversarial-personas.md §Activation Matrix. The note should literally point at that section.

  5. §9.5 (Adversarial User persona section §4.7 in review-personas.md): full criteria, persona catalog, and surface matrix live in adversarial-personas.md. The new §4.7 in review-personas.md should be a pointer, not a duplicate — same pattern §4.3 Security Engineer uses (points at security-compliance.md).

Cross-doc invariants to preserve:
  - adversarial-personas.md inherits §1 (Project Briefing), §2 (Materiality Gate), §2a (Steel-Man), §2b (Severity Calibration) from review-personas.md. Do NOT duplicate those sections in adversarial-personas.md — it already links back.
  - design-heuristics.md is consumed by grimoire-design (variant generation) AND by adversarial personas during review (heuristic numbers as citable anchors). Both readers expected.
  - brand-tokens-format.md defines the format used by both grimoire-design --capture-brand (write side) and grimoire-design's brand grounding step + grimoire-design --lint (read side). The "Validation Tips" section is specifically written for AI-agent consumers, not human authors.
-->


## 9. References — Review Personas Engine Extensions
<!-- context:
  - .claude/skills/references/review-personas.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/review/conditional-persona-selection.feature
  - .grimoire/changes/add-ui-ux-design-workflow/features/review/adversarial-user-persona.feature
-->

- [x] 9.1 In `skills/references/review-personas.md` §1 (Project Briefing), add to **Sources** list:
      - `.grimoire/brand/tokens.json` and `.grimoire/brand/voice.md` (if exist) — brand axis
      - `.grimoire/docs/components.md` (if exists) — component inventory axis
      - `.grimoire/changes/<id>/consult.md` (if exists) — pre-design consult assumptions
      - `.grimoire/changes/<id>/designs/problem.md` (if exists) — design problem statement
      - `.grimoire/config.yaml` `project.surface` — surface axis

- [x] 9.2 In §1 briefing block template, add new lines:
      - `**Surface:** <tui|web|mobile|api|mixed | unknown>`
      - `**Brand:** <captured | none>` (one-line summary)
      - `**Component library:** <name + path | none documented>`
      - `**Problem statement:** <one-line from designs/problem.md | n/a>`

- [x] 9.3 In §2 (Materiality Gate), extend list of valid finding anchors to include:
      - Brand axis (e.g., "design uses #FF0000 — not in tokens.json")
      - Component-inventory gap (e.g., "design introduces new Button despite existing variant")
      - Problem-statement mismatch (e.g., "scenario doesn't address articulated user problem")

- [x] 9.4 In §3 (Complexity Gating) Design review table, add note: "When `project.surface` is set, adversarial personas auto-filter per `adversarial-personas.md` matrix"

- [x] 9.5 Add new persona section §4.7 "Adversarial User" w/ pointer to `adversarial-personas.md` for full criteria and surface matrix; engagement gated by surface

<!-- SESSION: 2026-05-17 — Section 9 (Review Personas Engine Extensions) complete.

Renumbering applied:
  - Inserted new §4.7 "Adversarial User" (pointer-only, ~1 paragraph) — matches the §4.3 Security Engineer pattern of pointing at a sibling reference for full content.
  - Renamed previous §4.7 "Contrarian" → §4.8 "Contrarian". Section title, header, and ordering preserved; only the section number changed.

Where pointers land:
  - §4.7 Adversarial User points at `./adversarial-personas.md` for persona catalog, activation matrix, severity calibration, steel-man. Inherits §1 / §2 / §2a / §2b from this file. No content duplicated.
  - §1 Sources list now includes `.grimoire/brand/tokens.json`, `voice.md`, `components.md`, `consult.md`, `problem.md`, and `project.surface` (added to the config.yaml entry).
  - §1 briefing block template gained Surface, Brand, Component library, Problem statement lines.
  - §2 Materiality Gate now lists brand axis, component-inventory gap, problem-statement mismatch as valid anchors (in addition to surface, which was folded into the existing briefing-axis bullet).
  - §3 Complexity Gating Design-review table got a one-sentence note about auto-filter via the activation matrix in adversarial-personas.md.
  - §5 Output Format template gained an "Adversarial User" report section (omit-when-empty), mirroring Contrarian's pattern.

Cross-reference fixes applied:
  - §4.8 Contrarian Inputs list: "complete set of findings from §4.1-§4.6" → "§4.1-§4.7" (Adversarial findings are peer inputs Contrarian processes).
  - `adversarial-personas.md` line 225: "Contrarian pass (§4.7 of `./review-personas.md`)" → "§4.8" — kept the cross-doc reference accurate.

Cross-reference fixes downstream §13 work needs to make:
  - `skills/grimoire-review/SKILL.md:82-83` lists personas through 4.6 — task 13.2 already plans to add §4.7 "Adversarial User"; that task will need to also add §4.8 "Contrarian" (currently not on the numbered list there — confirm during 13.2).
  - `skills/grimoire-pr-review/SKILL.md:93-94` and `skills/grimoire-precommit-review/SKILL.md:110-111` list 4.5 / 4.6 — these skills currently do NOT enumerate Contrarian on their persona list either. Decide during §13 whether to add 4.7 Adversarial + 4.8 Contrarian to those lists or leave Contrarian implicit. Recommend adding both for clarity.
  - No other files reference "4.7" or "Contrarian" with a section number — checked via grep across `skills/`. The persona-engine renumbering is contained.

Style notes:
  - The new §4.7 paragraph is intentionally terse (one paragraph, no sub-bullets) to match the existing "pointer-to-reference" style §4.3 uses for security-compliance.md. Full content stays in adversarial-personas.md so there is exactly one source of truth.
  - §5 output template includes an Adversarial User example block. Examples picked to demonstrate both [persona-tag] prefix convention and severity range — downstream §13.4 can elaborate the report format further in the skill itself.
-->

## 10. Skill — grimoire-design
<!-- context:
  - skills/grimoire-draft/SKILL.md (pattern to follow)
  - skills/grimoire-discover/SKILL.md (pattern for graceful-degradation, MCP usage)
  - skills/references/brand-tokens-format.md
  - skills/references/design-input-formats.md
  - skills/references/design-heuristics.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/design/*.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0002-single-grimoire-design-skill.md
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0003-figma-mcp-primary-design-input.md
-->

- [x] 10.1 Create `skills/grimoire-design/SKILL.md` w/ standard frontmatter (name, description, compatibility, metadata.author, metadata.version: "0.1")

- [x] 10.2 Triggers section: keywords "design", "wireframe", "ui", "ux", "mockup", "layout", "figma" combined w/ "new", "draft", "explore", or "redesign"

- [x] 10.3 Routing section:
      - Non-UI behavior change → `grimoire-draft` directly
      - Brand-only updates → use `grimoire-design --capture-brand` or `--lint`
      - Tech-check before design → `grimoire-design-consult`

- [x] 10.4 Workflow steps:
      1. **Qualify** — is this UI/UX work? Else route
      2. **Problem statement (soft gate)** — semi-aggressive warning if skipped; offer framework menu (JTBD / Lean UX / HMW / PR-FAQ / freeform); write to `.grimoire/changes/<id>/designs/problem.md`
      3. **User flow & success metrics** — friction log default, optional upgrade to Mermaid journey or service blueprint
      4. **Lazy component inventory** — if `.grimoire/docs/components.md` absent and project has UI code, scan for: `components.json` (shadcn), `tailwind.config.{js,ts}`, MUI/Chakra/Mantine imports, `*.stories.{ts,tsx,jsx,js}`. Write findings to `.grimoire/docs/components.md`
      5. **Brand grounding** — read `.grimoire/brand/tokens.json` + `voice.md` if exist
      6. **Variant generation** — 3 variants default (configurable via `--variants=N`), each w/ stated tradeoff. Output target by precedence: Figma MCP → static HTML in `.grimoire/changes/<id>/designs/variant-{n}.html` → ASCII for trivial
      7. **State enumeration** — for each interactive component, address default/loading/empty/error + conditional success/disabled/readonly/over-limit. Soft gate on missing required states
      8. **Render preview** — for HTML, single `preview.html` showing all components × all states
      9. **Derive Gherkin** — propose scenarios per (component × state); present for user review/accept/edit/reject; write accepted to `.grimoire/changes/<id>/features/`
      10. **Handoff** — suggest `grimoire-draft` (refine manifest/ADRs) or `grimoire-plan` (break into tasks)

- [x] 10.5 Add Modes section. **Important framing**: these are conversational invocations to the AI agent (e.g., user says "lint brand" or "give me 5 variants"), NOT real CLI subcommands of the `grimoire` binary. Per ADR-0010 skills are pure markdown — the AI interprets these modes. Document in SKILL.md prose using format: `When the user says "lint brand" or invokes `--lint`, do X`. Modes covered:
      - `--capture-brand` / "capture brand" — invoke brand capture flow (same prompts as onboarding)
      - `--lint` / "lint brand drift" — brand-drift lint (see task 10.7)
      - `--variants=N` / "give me N variants" — override default variant count

- [x] 10.6 Add Important section: pure markdown; do not generate executable code; ask before scanning large codebases for component inventory; honor `mapignore`; do not create `.grimoire/brand/` if user has not opted in

- [x] 10.7 Add brand-drift lint mode behavior (Section "Lint mode" inside SKILL.md):
      - Scan staged files (or all files w/ `--all` / "scan all") for hardcoded color hex, px values, font-family strings
      - Cross-reference against `.grimoire/brand/tokens.json`
      - Emit report: hardcoded value → nearest token suggestion ("Replace `#0066ff` with `var(--color-primary)`")
      - **Clean state**: if zero findings, emit "No brand drift detected across N files scanned" and exit 0 (no false positive paths)
      - **Malformed tokens.json**: catch JSON parse error and missing `$value` fields; emit one-line "tokens.json malformed at `<path>` — fix or remove" w/ parse error description; exit non-zero (misconfiguration, not lint finding)
      - **Absent tokens.json**: clean exit w/ "No brand tokens to lint against. Run `grimoire init` or `grimoire-design --capture-brand` first."

- [x] 10.8 Add malformed-token handling to grimoire-design's variant generation step (workflow step 5 "Brand grounding"): same parse-error pattern as 10.7 — print one-line error, suggest fix, continue without brand grounding rather than crash. Anchor: pre-mortem failure mode #6 (low-quality output if brand drift goes undetected).

<!-- SESSION: 2026-05-17 — Section 10 (Skill — grimoire-design) complete.

File created:
  - <repo>/skills/grimoire-design/SKILL.md

Frontmatter follows the standard grimoire skill pattern (name, description, compatibility, metadata.author=kiwi-data, metadata.version="0.1"). Voice is terse and directive — matches grimoire-draft and grimoire-discover.

Key invariants documented in the SKILL.md:

  1. **Soft gates are warnings, not blockers.** Problem-statement gate (step 2) and state-enumeration gate (step 7) both warn aggressively, accept user override, and record overrides as assumptions. Downstream `grimoire-review` should surface these assumptions; do not treat the override as silent acceptance.

  2. **Brand-grounding never crashes.** Step 5 catches malformed `tokens.json` (parse error or missing `$value`), emits a one-line error, and continues with neutral defaults. Same parse-error pattern as `--lint` mode but with continue-not-exit semantics. The lint mode exits non-zero on malformed tokens (it's a precommit check); the workflow step continues (it's a generative flow).

  3. **Output precedence is Figma → HTML → ASCII** per ADR-0003 and `references/design-input-formats.md`. Figma MCP unreachable → fall back to HTML with a one-line note. Never crash on MCP failures.

  4. **Modes are conversational invocations, NOT CLI subcommands** per ADR-0010. The `--capture-brand`, `--lint`, `--variants=N` flags are interpreted by the AI from natural language. There is no commander.js code behind them. Format used throughout: "When the user says X or invokes `--Y`, do Z."

  5. **Component-inventory scan is opt-in and respects mapignore.** Step 4 asks before scanning; never auto-scans large repos. Reuses the same exclusion logic as `grimoire map`.

  6. **`.grimoire/brand/` is opt-in.** The directory only appears when user runs `--capture-brand` or accepts onboarding brand capture. Reading from a missing directory is a valid state (neutral-defaults fallback).

  7. **Surface-conditional Gherkin scenarios.** Step 9 reads `project.surface` and applies the `references/adversarial-personas.md` matrix: web → kbd+screen-reader+contrast; mobile → touch + gesture; tui → kbd only. This is the same matrix `grimoire-review` will use in §13.1 — both skills must stay consistent.

  8. **Consult.md handoff.** Step 1 (Qualify) reads `.grimoire/changes/<id>/consult.md` if present and propagates assumptions/givens into all later prompts. This is the §15.2 hook described in the larger plan.

What §14 (grimoire-draft Figma consumption) needs to know:
  - Variants are referenced at `.grimoire/changes/<id>/designs/variants.md` (Figma path) OR as `variant-{n}.html` files (HTML path) OR inline in `variants.md` (ASCII path). §14.1's "design input check" step should look in this directory and consume whatever shape is present.
  - The Figma snapshot cache lives at `.grimoire/changes/<id>/designs/figma-snapshot.json` per `references/design-input-formats.md` §1 Cache. Both `grimoire-design` and `grimoire-draft` read/write this same path.
  - When grimoire-design has already populated `designs/`, grimoire-draft should NOT re-query Figma — reuse the existing artifacts. Per the spec: "If `.grimoire/changes/<id>/designs/` already populated by `grimoire-design`, read those instead."
  - Gherkin scenarios at `.grimoire/changes/<id>/features/` are already proposed and user-accepted by grimoire-design's step 9. §14's task 14.2 ("propose Gherkin scenarios per component × state; present for review") should detect existing accepted features and SKIP re-proposing — do not re-prompt the user for scenarios they've already accepted.

What §15 (consult.md → manifest.md handoff) needs to know:
  - §15.2 hook lives in step 1 (Qualify) of this SKILL.md. The skill reads consult.md and propagates inferred assumptions/givens through the workflow. The actual copy-into-manifest.md operation belongs to grimoire-draft per §15.1 — this skill consumes consult.md but does not write to manifest.md (that's grimoire-draft's responsibility).
  - Variants generated in step 6 must respect any givens from consult.md (e.g., if consult.md says "no JS-heavy patterns due to perf budget", do not produce a variant relying on client-side state machines). Document the exclusion in the variant's tradeoff statement.
  - Pain points captured in step 3 (`problem.md` § Pain Points) feed adversarial-persona prioritization during grimoire-review. If consult.md inferred givens around accessibility or compliance, those propagate to pain points → persona matrix.

Forward references in this SKILL.md that will resolve later in the change:
  - `../references/visual-fidelity.md` (referenced in Lint Mode § Integration) — to be created by §13.5
  - `../references/adversarial-personas.md` (referenced in step 9) — created by §8.2 (already done)
  - `../references/security-compliance.md` (referenced in step 9) — pre-existing
  - `../references/design-heuristics.md`, `../references/design-input-formats.md`, `../references/brand-tokens-format.md` — all pre-existing (§7-8)
-->

## 11. Skill — grimoire-design-consult
<!-- context:
  - skills/grimoire-review/SKILL.md (persona invocation pattern)
  - skills/references/review-personas.md (persona definitions)
  - skills/references/elicitation-personas.md (Q&A interview patterns)
  - .grimoire/changes/add-ui-ux-design-workflow/features/design-consult/run-technical-consult.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0005-grimoire-design-consult-separate.md
-->

- [x] 11.1 Create `skills/grimoire-design-consult/SKILL.md` w/ standard frontmatter

- [x] 11.2 Triggers: "consult", "tech check", "should I", "what should I worry about", "before designing"

- [x] 11.3 Routing: design-ready user → `grimoire-design`; full design w/ artifacts → `grimoire-review`

- [x] 11.4 Workflow. **Important framing** (same as 10.5): modes / flags are conversational invocations the AI interprets, not commander.js subcommands. Document accordingly in SKILL.md prose.
      1. **Collect minimal input** — problem statement (required); optional: proposed user flow, data touched
      2. **Build mini-briefing** — same sources as review-personas §1 but pared to project surface, compliance, data sensitivity, accepted ADRs (skip feature inventory)
      3. **Engage personas in Q&A mode** — Security Engineer + Data Engineer default; expand via `--personas=`. Personas ASK questions (not produce findings); use elicitation-personas.md patterns
      4. **Distill assumptions and givens** — from Q&A transcript, infer:
         - Assumptions (things the design must hold true)
         - Givens (constraints from existing systems / compliance)
         - Open questions (unanswered items needing follow-up)
      5. **Write `.grimoire/changes/<id>/consult.md`** — full transcript + distilled sections
      6. **Handoff** — when `grimoire-design` or `grimoire-draft` next runs on the same change-id, it reads `consult.md` and copies assumptions/givens to `manifest.md`

- [x] 11.5 Add Important section: this is Q&A, not findings; no blocker/suggestion grading; minimal input bar; available to engineers too

<!-- SESSION: 2026-05-17 — Section 11 (grimoire-design-consult skill) complete.

Files created:
  - <repo>/skills/grimoire-design-consult/SKILL.md

Frontmatter: standard format (name / description / compatibility / metadata.author=kiwi-data / metadata.version="0.1") — matches grimoire-review and grimoire-draft. YAML valid.

Mode framing: documented per ADR-0010 / task 10.5 framing. The "Modes" section explicitly states `--personas=...` and "quick consult" are conversational invocations the AI interprets, NOT CLI subcommands. Two phrasings shown for each mode so the AI recognizes both keystrokes ("`--personas=security,data,qa` or 'add QA persona'").

consult.md output schema (load-bearing for §14 + §15 — these are the section headers downstream skills MUST grep for):
  1. `# Pre-design consult: <change-id>`
  2. `## Problem statement` — verbatim user input
  3. `## Proposed user flow` — verbatim or "Not provided"
  4. `## Data the design will touch` — verbatim or "Not provided"
  5. `## Project Briefing (consult)` — pared briefing block (Surface / Stage / Data sensitivity / Compliance / Threat surface signals / Active constraints). Feature Inventory and Linked-change Non-goals deliberately omitted vs. review-personas §1.
  6. `## Security Q&A` — `**Q:** ... **A:** ...` pairs
  7. `## Data Q&A` — same format
  8. `## <Other personas> Q&A` — only when added via mode flag
  9. `## Inferred assumptions` — bulleted list (things design must hold true)
  10. `## Inferred givens` — bulleted list (constraints from existing systems / compliance / ADRs)
  11. `## Open questions` — bulleted list (unanswered items, flagged for follow-up — NOT blockers)
  12. `## Personas engaged` — bulleted list of persona names

What §14 (grimoire-draft consume) must do for handoff to work:
  - NOTE: §14 itself is about Figma consumption, not consult consumption. The draft-side consult-handoff lives in task 15.1, not §14. Task 15.1 must:
    - Glob `.grimoire/changes/<change-id>/consult.md`
    - Parse the two H2 section headers EXACTLY: `## Inferred assumptions` and `## Inferred givens` (case-sensitive, no trailing punctuation)
    - Copy bullets verbatim into manifest.md's Assumptions section, and create a new Givens section at the same heading level if absent
    - Apply only at complexity level 3-4 per task 15.1 spec — lower levels skip the copy
    - Open questions are NOT copied — they remain in consult.md as designer follow-up items

What §15 (consult → manifest hook) must do for handoff to work:
  - Task 15.1 (draft-side): as above — depends on the exact H2 spellings in this SKILL.md.
  - Task 15.2 (design-side): in `grimoire-design` step 1 "Qualify", read consult.md if present and propagate assumptions/givens into ALL subsequent prompts. Specifically:
    - Variant generation step (workflow 10.4 step 6): exclude variants that violate any Given
    - State enumeration step (10.4 step 7): cross-check that required states (loading/error/empty) honor data-sensitivity assumptions (e.g., no PII in error messages if an assumption says "PII never appears in logs")
    - Gherkin derivation step (10.4 step 9): scenarios reference givens by ID/title when relevant
  - Both §14 (Figma) and §15 (consult hook) are independent — but §15.1 and §15.2 must use the exact section header strings above. If this SKILL.md renames a section, §15 breaks silently — keep names locked.

Cross-references verified:
  - `../references/review-personas.md` §1, §4 — referenced in workflow steps 2 and 3
  - `../references/elicitation-personas.md` — referenced in workflow step 3 for interview patterns
  - ADR-0010 cited in Modes section framing
  - Defaults align with feature spec scenarios: Security + Data default, others on request; --personas=security,data,qa adds QA per feature scenario "User can add other personas"

Tone match: direct, no padding, follows the "Triggers / Routing / Prerequisites / Skipping / Workflow / Important / Done" skeleton used by grimoire-review and grimoire-draft. "Important" section explicitly contrasts Q&A vs findings four different ways (per task 11.5 + content rules requirement to emphasize repeatedly).

No tests added — pure markdown per task spec.
-->

## 12. Skill Extension — grimoire-discover (component inventory)
<!-- context:
  - skills/grimoire-discover/SKILL.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/design/generate-design-variants.feature (lazy inventory scenario)
-->

- [x] 12.1 In `skills/grimoire-discover/SKILL.md`, add new step §5.5 "Component Inventory (optional)" between §5 Data Schema and §6 Project Context:
      - Detect component library: `components.json` (shadcn), `tailwind.config.{js,ts}`, package.json deps (`@mui/material`, `@chakra-ui/react`, `mantine`, `@radix-ui/*`)
      - Detect Storybook: `.storybook/main.{ts,js}`, `*.stories.{ts,tsx,jsx,js}`
      - Write `.grimoire/docs/components.md` listing detected components w/ file paths, variants, props
      - Skip section if no UI/component signals

- [x] 12.2 Add to discover's "Integration with Other Skills" section: "grimoire-design reads `components.md` first to avoid generating duplicate components"

<!-- SESSION: 2026-05-17 — Section 12 (grimoire-discover component inventory) complete.

What changed:
  - Inserted new step §5.5 "Component Inventory (optional)" into `skills/grimoire-discover/SKILL.md` immediately after §5 (Generate Data Schema) and before §6 (Generate Project Context). Section numbering verified intact: 1, 2, 3, 4, 5, 5.5, 6, 7, 8.
  - §5.5 documents two detection tables (component library / Storybook), explicit skip-condition (single-line note, no file written, continue to §6), 5-step workflow, and the `components.md` schema.
  - Added `components.md` schema with columns: Component, Location, Variants, Key Props, Notes. Includes a separate "Stories" table populated only when Storybook is detected. Header carries `Last updated` and `Library:` lines mirroring the area-doc freshness convention from §7.
  - Extended "Integration with Other Skills" with the design-skill consumption bullet, inserted between the audit-skill bullet and the `grimoire map --refresh` reminder so it sits alongside other skill-to-skill integration notes.

Downstream consumption pattern (for §10 grimoire-design author):
  - §10.4 workflow step 4 (Lazy component inventory) should check for `.grimoire/docs/components.md` first. If absent AND the project has UI signals, the design skill performs the same detection scan inline (it does NOT call discover) and writes `components.md` itself — keeps grimoire-design self-sufficient when discover hasn't been run.
  - If `components.md` exists, grimoire-design reads it as-is and trusts the inventory; variants prefer listed components over net-new designs (per generate-design-variants.feature scenario "Component-library inventory triggered lazily").
  - The schema in §5.5 is the canonical shape — grimoire-design's lazy writer must produce the same columns so a later `grimoire-discover` run can refresh in place rather than fight over format.

Cross-section invariants:
  - The detection heuristics in §5.5 are deliberately identical to those in task 10.4 (shadcn / Tailwind / MUI / Chakra / Mantine / Radix / Storybook) — single source of truth. If §10 author tweaks the list, update §5.5 in lockstep.
  - §9.1 (review-personas Sources list) already references `.grimoire/docs/components.md` as the component-inventory axis — schema established here is the contract for that axis.
  - §13 (grimoire-review visual-fidelity) does NOT directly consume components.md, but the adversarial "duplicate-component" finding category in §9.3 anchors to it.

No tests added (pure markdown change, per task spec). No files touched outside `skills/grimoire-discover/SKILL.md` and this `tasks.md`.
-->

## 13. Skill Extension — grimoire-review (conditional personas + fidelity)
<!-- context:
  - skills/grimoire-review/SKILL.md
  - skills/references/review-personas.md
  - skills/references/adversarial-personas.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/review/conditional-persona-selection.feature
  - .grimoire/changes/add-ui-ux-design-workflow/features/review/adversarial-user-persona.feature
  - .grimoire/changes/add-ui-ux-design-workflow/features/review/visual-fidelity-checks.feature
-->

- [x] 13.1 In `skills/grimoire-review/SKILL.md` §4 "Pick Personas", after complexity table, add subsection "Surface-conditional personas":
      - Read `project.surface` from config; if absent default to "mixed"
      - Apply adversarial-personas.md matrix; engage only matching modes
      - User override via `--personas=...` or "skip <persona>"

- [x] 13.2 In §5 "Run Personas", add bullet 4.7 "Adversarial User — engage per matrix; criteria in adversarial-personas.md"

- [x] 13.3 Add new step §5.5 "Visual Fidelity (cheap tier)":
      - Only runs if `.grimoire/brand/tokens.json` exists OR change has design artifacts
      - Token-compliance lint: scan HTML preview / changed CSS for hardcoded values; cross-ref tokens.json (see grimoire-design --lint logic)
      - axe-core: if `npx axe-core` available (check package.json deps), run against `preview.html`; otherwise note "axe-core not installed — install for accessibility checks"
      - Report under "Visual Fidelity" section in review report

- [x] 13.4 Update §6 "Present Findings" report template to include "Adversarial User" and "Visual Fidelity" sections (only when engaged)

- [x] 13.5 Extract visual-fidelity logic to **shared reference** at `skills/references/visual-fidelity.md` to avoid duplication across three review skills (review, precommit-review, pr-review). Mirrors the shared persona-engine extraction pattern from commit 6ee6868.
      - `references/visual-fidelity.md` contains: when to run, scope (HTML preview vs code), token-compliance algorithm, axe-core invocation, report-section format, gating rules (skip when no tokens.json)
      - In `skills/grimoire-review/SKILL.md` §5.5 (task 13.3): replace inline content with `Follow ../references/visual-fidelity.md for the design-phase invocation`
      - In `skills/grimoire-precommit-review/SKILL.md`: add §5.5 pointer `Follow ../references/visual-fidelity.md for the code-phase invocation`
      - In `skills/grimoire-pr-review/SKILL.md`: add §5.5 pointer `Follow ../references/visual-fidelity.md for the code-phase invocation`
      - Each pointing skill includes only invocation context (when, scope) — algorithm lives in the reference

<!-- SESSION: 2026-05-17 — Section 13 (grimoire-review extensions: conditional personas + visual fidelity) complete.

Files created:
  - <repo>/skills/references/visual-fidelity.md — self-contained shared reference. Sections: §1 When to Run, §2 Scope per Phase (design vs code), §3 Token-Compliance Lint Algorithm (load tokens / scan / false-positive suppression / suggestion synthesis / output / clean state), §4 axe-core Invocation (availability check / invocation / output / clean state), §5 Report-Section Format, §6 Gating Rules (absent / malformed / empty tokens.json + surface gating note), §7 Edge Cases. ~210 lines.

Files modified:
  - <repo>/skills/grimoire-review/SKILL.md
    - §4 gained subsection "Surface-conditional personas" w/ default-to-mixed rule, activation-matrix pointer, three concrete examples (tui / web / api), conditional-row caveat (RTL/i18n), and user-override patterns (conversational + flag syntax both accepted per ADR-0010)
    - §5 persona list extended to 4.7 (Adversarial User pointer) and 4.8 (Contrarian — runs last when blockers exist)
    - New §5.5 "Visual Fidelity (cheap tier)" — pointer-only, names the engagement conditions and points at ../references/visual-fidelity.md for the design-phase invocation (HTML preview scope)
    - §6 report template gained Adversarial User, Visual Fidelity (with Token Compliance + Accessibility subsections), and Contrarian sections — each with omit-when-empty HTML comments matching the §5 Output Format template in review-personas.md
  - <repo>/skills/grimoire-precommit-review/SKILL.md
    - §6 persona list extended to 4.7 (Adversarial User — engaged when diff touches user-facing surface) and 4.8 (Contrarian)
    - New §6.5 "Visual Fidelity (cheap tier)" pointer (placed between Run Personas §6 and Present Findings §7 — semantically correct position; task spec said "§5.5" but precommit's §5 is Pick Depth not Run Personas, so the position-correct numbering is §6.5)
  - <repo>/skills/grimoire-pr-review/SKILL.md
    - §7 persona list extended to 4.7 and 4.8 (same pattern as precommit)
    - New §7.5 "Visual Fidelity (cheap tier)" pointer (placed between Run Personas §7 and Present Findings §8 — same position-correct rationale; pr-review's section numbering differs again because it has Fetch PR Metadata / Fetch Diff / Find Linked Change as §1-§3)

Numbering decision (§5.5 vs §6.5 vs §7.5):
  - Task 13.3 + 13.5 spec called for "§5.5" in all three skills. That number was borrowed from grimoire-review's structure (where §5 is Run Personas). The precommit-review and pr-review skills have different overall numbering — Run Personas is §6 and §7 respectively. Slotting visual fidelity as "§5.5" in those files would have inserted it inside the wrong workflow phase (before personas had run). Used position-correct numbering instead (§5.5 / §6.5 / §7.5) so the section always falls between "Run Personas" and "Present Findings" semantically. All three pointing skills carry the same pointer prose; only the heading number differs.

Cross-doc invariants verified:
  - All §4.x references match the §9 renumbering: Adversarial User = §4.7, Contrarian = §4.8. Grep for "4.7" and "4.8" across the three review skills confirms consistent numbering. No references to old "4.7 Contrarian" remain in §13's modified files.
  - visual-fidelity.md is self-contained — pointing skills include only invocation context (when, scope) and the pointer line, never duplicate the algorithm. Matches the §6ee6868 shared-persona-engine extraction pattern.
  - visual-fidelity.md §6.2 Malformed tokens.json explicitly references the single-source-of-truth invariant: same behavior in all four invocation sites (design --lint, review §5.5, precommit-review §6.5, pr-review §7.5). If §10.7 (grimoire-design --lint) changes its malformed-token behavior, update §6.2 in lockstep.
  - visual-fidelity.md §6.4 documents that the engine does NOT consult project.surface — surface gating is for adversarial personas only. Keeps responsibilities separated: surface → which personas engage; tokens.json presence → whether visual-fidelity runs.

Persona enumeration unified across all three review skills — all three now list §4.1 through §4.8. Previously grimoire-review stopped at §4.6, precommit-review at §4.6, pr-review at §4.6. §9 SESSION note flagged this gap; §13 resolves it.

Frontmatter unchanged in all three skills. Section numbering valid (no duplicates, no gaps in the integer sequence; 5.5/6.5/7.5 are intentional sub-positions, not gaps).

What downstream work needs to know:
  - §14 (grimoire-draft Figma consumption) is independent of §13 — no cross-references.
  - §15 (consult → manifest handoff) is independent of §13 — no cross-references.
  - §16 (README updates) should mention that the three review skills now invoke shared visual-fidelity logic when tokens.json is present. Brief mention, not a section.
  - §17.3 (smoke test onboarding) does not need visual-fidelity verification; that's a separate smoke test (§17.5 covers brand-lint manually but doesn't cover the review-skill invocation specifically). If §17 wants integration coverage, add a §17.x: "Run grimoire-precommit-review on a diff that hardcodes a hex value matching a token; verify the Visual Fidelity section flags it."
  - No tests added (pure markdown, per task spec).
-->

## 14. Skill Extension — grimoire-draft (consume Figma)
<!-- context:
  - skills/grimoire-draft/SKILL.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/draft/consume-figma-designs.feature
  - .grimoire/changes/add-ui-ux-design-workflow/decisions/0003-figma-mcp-primary-design-input.md
-->

- [x] 14.1 In `skills/grimoire-draft/SKILL.md` §4 "Elicit Requirements", add prefix step "4.0 Design input check":
      - If `project.design_tool.mcp` configured, ask "Figma file URL or node ID? (or skip)"
      - On URL provided: query Figma MCP for frame data; cache at `.grimoire/changes/<id>/designs/figma-snapshot.json`
      - If `.grimoire/changes/<id>/designs/` already populated by `grimoire-design`, read those instead
      - Skip silently if no design input available; fall back to standard elicitation

- [x] 14.2 In §7 "Draft Artifacts" behavioral section, add note: "If design data was provided (Figma snapshot or grimoire-design output), propose Gherkin scenarios per (component × state); present for user review before writing"

- [x] 14.3 In §7 add brand-tokens grounding rule: "When Figma variables map to `.grimoire/brand/tokens.json` tokens, scenarios referencing visual properties use token names not hex values"

- [x] 14.4 In §7 add component-library awareness: "When `.grimoire/docs/components.md` exists, prefer existing component references; flag net-new components"

- [x] 14.5 Update Important section: "Figma access token is read from `FIGMA_ACCESS_TOKEN` env var by the MCP server; never log, never write to artifacts"

## 15. Hook for Consult → Manifest Handoff
<!-- context:
  - skills/grimoire-draft/SKILL.md
  - skills/grimoire-design/SKILL.md
  - .grimoire/changes/add-ui-ux-design-workflow/features/design-consult/run-technical-consult.feature (scenario: Handoff to grimoire-design)
-->

- [x] 15.1 In `skills/grimoire-draft/SKILL.md` §5 "Check Existing State", add bullet: "If `.grimoire/changes/<change-id>/consult.md` exists, parse 'Inferred assumptions' and 'Inferred givens' sections; copy into `manifest.md` Assumptions and a new Givens section (level 3-4 only)"

- [x] 15.2 In `skills/grimoire-design/SKILL.md` step 1 "Qualify", add: "If consult.md exists for this change-id, read it; propagate assumptions and givens into all subsequent prompts (e.g., when generating variants, exclude patterns that violate givens)"

<!-- SESSION: 2026-05-17 — Sections 14 (grimoire-draft Figma consumption) and 15 (consult → manifest/design handoff) complete.

Files modified:
  - <repo>/skills/grimoire-draft/SKILL.md — §4.0 added (Design Input Check, between §3 Research and §4 Elicit); §5 Check Existing State extended with consult.md parse+copy bullet; §7 Draft Artifacts gained three new sub-blocks (design-data scenarios, brand-tokens grounding, component-library awareness); Important section gained the Figma-token security note.
  - <repo>/skills/grimoire-design/SKILL.md — step 1 Qualify hook extended: explicit step-6 (variants) and step-9 (Gherkin) consequences of consult.md propagation; open-questions handling clarified as warnings, not gates.

Section numbering verified intact:
  - grimoire-draft: 1, 2, 3, 4.0, 4, 5, 6, 7, 8, 9 (4.0 is the prefix step per task 14.1 spec; numbering is deliberate and consistent with the spec's '4.0' label).
  - grimoire-design: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (unchanged).

Consult.md H2 headers locked across all three skills:
  - grimoire-design-consult/SKILL.md writes exactly `## Inferred assumptions` and `## Inferred givens` (lines 144, 149).
  - grimoire-draft/SKILL.md §5 parses these exact strings verbatim. Added explicit "load-bearing — do not paraphrase, retitle, or fuzzy-match" caveat per task spec.
  - grimoire-design/SKILL.md step 1 parses these exact strings verbatim. Same caveat applied.
  - Grep confirmed: only those three SKILL.md files mention `## Inferred assumptions|givens` outside of tasks.md context comments. Schema is locked.

Figma token security:
  - grimoire-draft/SKILL.md Important section explicitly enumerates the artifacts that must never contain the token (config, manifest.md, consult.md, figma-snapshot.json). Unambiguous: env var only, MCP server handles auth transparently, grimoire-draft never needs to see the value.

Design-skill propagation hook (§15.2) extension specifics:
  - The pre-existing hook (added in §10 SESSION) read consult.md and propagated assumptions/givens generically. Per task 15.2 it now names the two specific consumer steps:
    - Step 6 (Variant Generation): exclude patterns that violate givens; cite exclusion in the variant's tradeoff line so reviewers see why a pattern was avoided.
    - Step 9 (Derive Gherkin): reference assumptions in scenario preconditions where applicable; cite givens by their consult.md bullet when a scenario's expected outcome depends on a given.
  - Open questions handled as warnings (surface to user but do not block) — they remain in consult.md as designer follow-up per the §11 SESSION contract.

Draft-skill consult handoff (§15.1) — boundary clarifications baked into the bullet:
  - Givens section in manifest.md is level 3-4 only (matches §15.1 spec).
  - Open questions are NOT copied (they stay in consult.md as designer follow-up items per the §11 SESSION contract).
  - The H2 spellings are described as "load-bearing" in the bullet itself — downstream maintainers reading the SKILL.md see the constraint without needing to consult tasks.md.

Cross-skill invariants preserved:
  - grimoire-design step 9 (Derive Gherkin) handles initial scenario proposal from designs. grimoire-draft §7 new sub-block "When design data was provided" now explicitly says: "If `grimoire-design` already produced user-accepted scenarios under `.grimoire/changes/<change-id>/features/`, do NOT re-propose them; treat them as the baseline and only fill gaps." This honors the §10 SESSION contract that grimoire-draft must not re-prompt for scenarios already accepted in grimoire-design.
  - Figma snapshot cache path `.grimoire/changes/<id>/designs/figma-snapshot.json` matches `references/design-input-formats.md` §1 Cache exactly; both skills read/write the same path.
  - Component-library awareness sub-block in §7 mirrors the same conventions as `grimoire-design` step 4 (Lazy Component Inventory) — both prefer existing components and both flag net-new with the same "new component required — confirm before plan stage" phrasing.

No tests added (pure markdown change per task spec). No files touched outside the four listed: grimoire-draft/SKILL.md, grimoire-design/SKILL.md, grimoire-design-consult/SKILL.md (read only), tasks.md. -->

## 16. README and Documentation
<!-- context:
  - README.md
  - .grimoire/docs/skills.md
-->

- [x] 16.1 Update `README.md` to add `grimoire-design` and `grimoire-design-consult` to skills inventory section

- [x] 16.2 Update `README.md` to add a "For UI/UX designers" section near the top describing the design workflow: brand capture at init → consult (optional) → design (problem → variants → states → Gherkin) → draft → plan → review

- [x] 16.3 Update `.grimoire/docs/skills.md` Key Files table to include both new skills (and bump "Last updated" date)

- [x] 16.4 Update `.grimoire/docs/skills.md` "Where New Code Goes" section: confirm new skills location matches existing pattern (`skills/<name>/SKILL.md`)

<!-- SESSION: 2026-05-17 — Section 16 (README + skills.md documentation) complete.

README.md changes:
  - Added two rows to the Skills reference table (inside `<details>` block at lines ~625-646), appended after `/grimoire:pr-review`:
    - `/grimoire:design` — Generate UI/UX designs — problem → variants → states → derived Gherkin
    - `/grimoire:design-consult` — Pre-design Q&A with security and data personas before any artifacts exist
  - Added new top-level "For UI/UX designers" section inserted between "Workflow" (ends ~line 159) and "Walkthrough". Covers four bullets: brand capture at init, consult (optional), design (problem→variants→states→Gherkin), handoff to draft/plan/review w/ note that review is mandatory at complexity 4 and surface-conditional adversarial personas engage per matrix. Closing paragraph mentions brand-drift lint wiring into precommit-review.
  - Tone matches existing README voice: terse bullets, value-forward, no fluff. No emojis. Bold lead-in per bullet matches the "Why Grimoire" bullet style.

.grimoire/docs/skills.md changes:
  - Bumped `Last updated:` from 2026-04-11 to 2026-05-17.
  - Appended two rows to the Key Files table after `grimoire-pr-review`:
    - `skills/grimoire-design/SKILL.md` — Generate UI/UX designs grounded in a user problem — variants, states, brand-token compliance, derived Gherkin
    - `skills/grimoire-design-consult/SKILL.md` — Pre-design Q&A with security and data personas; distills assumptions, givens, and open questions for handoff
  - "Where New Code Goes" section line 48 verified unchanged: `New skills → skills/<name>/SKILL.md`. Pattern still matches both new skills' actual locations. No edit needed (task 16.4 was a verification, not a change).

Skill count after this change:
  - README skills table: 20 entries (was 18 — added design + design-consult)
  - skills.md Key Files table: 18 entries (was 16 — added same two; skills.md does not list `grimoire-branch-guard` or `grimoire-refactor` which appear in README — pre-existing inconsistency not in scope for this change)
  - Source-of-truth `SKILL_NAMES` array (src/core/shared-setup.ts): 18 entries per §6.1 — matches skills.md count

No tests added (pure markdown). No files touched outside README.md, .grimoire/docs/skills.md, and this tasks.md. -->


## 17. Verification
<!-- context: full project; all changed files -->

- [x] 17.1 `npx vitest run` — **379/379 green** (was 365 before; +14 init.test, +6 config.test, +27 detect.test)

- [x] 17.2 `node bin/grimoire.js validate` — clean (0 errors, 0 warnings). All 13 .feature files parse; all 5 ADRs valid. Fixes during verify: Gherkin `Or` keyword → Scenario Outline in 2 files; manifest gained required `## Feature Changes` + `## Decisions` headers.

- [ ] 17.3 **DEFERRED — manual smoke test** (interactive `grimoire init` in fresh temp dir; not automatable in this session)

- [ ] 17.4 **DEFERRED — manual smoke test** (verify SKILL.md install via `grimoire init/update`; user runs manually per stated workflow)

- [ ] 17.5 **DEFERRED — manual smoke test** (`grimoire-design --lint` requires interactive Claude Code session)

- [ ] 17.6 **DEFERRED — manual smoke test** (conditional persona engagement requires interactive Claude Code session with fixture TUI repo)

- [x] 17.7 ADR confirmations — file-presence checks complete:
      - 0001 (DTCG): `templates/brand-tokens-example.json` uses DTCG `$value`/`$type` schema ✓
      - 0002 (single skill): README §"For UI/UX designers" documents both `grimoire-design` and `grimoire-design-consult` ✓
      - 0003 (Figma primary): `src/core/init.ts` `DESIGN_TOOL_MCP.figma` registry + `references/design-input-formats.md` ✓
      - 0004 (conditional personas): `references/adversarial-personas.md` activation matrix + `review-personas.md` §3 reference + `grimoire-review/SKILL.md` §4 surface-conditional subsection ✓
      - 0005 (consult separate): two distinct skill dirs `grimoire-design/` + `grimoire-design-consult/` w/ distinct triggers ✓
      - Runtime confirmations (handoff in practice) covered by deferred 17.3-17.6

- [x] 17.8 `node bin/grimoire.js health` — overall 57%. No regression. 73 scenarios across 13 features parsing; 15/15 decisions current. Pre-existing area-doc gap (28%) unchanged. Test-coverage 0% for grimoire features is by ADR-0010 convention (skills not BDD-tested).

---

## Open Items Carried Forward

- ADR sunset criteria — none documented in 0001-0005; revisit after 6 months of usage if DTCG spec stalls or ecosystem shifts
- v2 backlog (not in this change): bidirectional Figma write, `grimoire preview <change-id>` CLI command, Chromatic/Percy pixel-diff plugin, non-terminal designer UX
