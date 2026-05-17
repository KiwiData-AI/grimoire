---
complexity: 4
status: draft
---

# Change: Add UI/UX design workflow

## Why

Grimoire today serves engineers drafting behavioral specs. UI/UX designers are a parallel audience who:
- Need to capture brand guidelines, problem statements, and process flows as first-class artifacts
- Get the most value from grimoire's review engine when applied to designs *before* code exists
- Are commonly blindsided by security/data concerns that engineering catches late
- Want generated designs that consume real component libraries instead of producing "generic AI UI"

No existing SDD/BDD framework bridges Figma-style design artifacts into Gherkin task generation. Closest mainstream tool (AWS Kiro) names `design.md` but doesn't link design files. This change positions grimoire as the first BDD workflow that treats UI design as a verifiable upstream artifact feeding `grimoire-draft`.

## Non-goals

- Inventing a YAML/JSON DSL for designs (use Figma/MCP-native formats; HTML/ASCII only as fallback)
- Generating production-ready UI code (designs feed `grimoire-draft`/`grimoire-apply`; we don't bypass them)
- Non-terminal designer UX (no web app, no GUI; designers pair w/ terminal-comfortable user this pass)
- Pixel-diff visual regression (cheap tier only: token-compliance lint + axe-core)
- Day-one Sketch/Penpot/Framer parity (Figma primary; others stubbed via generic MCP setup)
- Writing to Figma canvas from Claude (read-only consumption only)

## Feature Changes

- **ADDED** `onboarding/capture-brand-guidelines.feature` — brand token capture prompts during `grimoire init`
- **ADDED** `onboarding/setup-design-tool-mcp.feature` — Figma/Sketch/other MCP wiring at onboarding
- **ADDED** `onboarding/detect-project-surface.feature` — auto-detect tui/web/mobile/api/mixed surface
- **ADDED** `design/initiate-design-session.feature` — problem statement gate + flow + pain points + metrics
- **ADDED** `design/generate-design-variants.feature` — 3-variant default w/ brand grounding
- **ADDED** `design/enumerate-component-states.feature` — required default/loading/empty/error states
- **ADDED** `design/derive-gherkin-scenarios.feature` — propose Gherkin per (component × state)
- **ADDED** `design-consult/run-technical-consult.feature` — Q&A consult mode before designing
- **ADDED** `review/conditional-persona-selection.feature` — surface-driven persona selection
- **ADDED** `review/adversarial-user-persona.feature` — accessibility/i18n/hostile-actor evaluation
- **ADDED** `review/visual-fidelity-checks.feature` — token-lint + axe-core fidelity tier
- **ADDED** `draft/consume-figma-designs.feature` — grimoire-draft reads Figma via MCP
- **ADDED** `brand/lint-brand-drift.feature` — detect hardcoded values diverging from tokens.json

## Decisions

- **ADDED** ADR-0016 — DTCG (W3C Design Tokens) for brand guidelines
- **ADDED** ADR-0017 — Single `grimoire-design` skill (not split brand/design/figma)
- **ADDED** ADR-0018 — Figma MCP canonical design input; HTML/ASCII fallback
- **ADDED** ADR-0019 — Conditional review personas by project surface
- **ADDED** ADR-0020 — `grimoire-design-consult` separate skill (not review flag)

## Artifacts

**New skills:**
- `grimoire-design` — interactive design generator (problem statement → variants → states → Gherkin proposals)
- `grimoire-design-consult` — minimal Q&A surfacing security/data concerns before full design work

**Skill extensions:**
- `grimoire-discover` / `init` — brand capture, design-tool MCP setup, project-surface detection
- `grimoire-review` — conditional personas by surface, adversarial-user persona, cheap visual fidelity tier, brand/inventory/problem-statement briefing axes
- `grimoire-draft` — accept Figma URL/MCP design context as input, auto-propose Gherkin scenarios per component state
- New skill mode: `grimoire-design --lint` — brand-drift detection against `.grimoire/brand/tokens.json`

**New references:**
- `.claude/skills/references/design-heuristics.md` — Nielsen 10, WCAG 2.2 AA, deceptive patterns, Fitts/Hick/Miller
- `.claude/skills/references/adversarial-personas.md` — screen-reader, keyboard, low-vision, color-blind, low-bandwidth, RTL, low-literacy, hostile actor; conditional applicability matrix
- `.claude/skills/references/design-input-formats.md` — Figma MCP, shadcn MCP, Storybook MCP, design-extract; fallback HTML/ASCII rules
- `.claude/skills/references/brand-tokens-format.md` — DTCG W3C Design Tokens schema reference + voice/tone format

**New decisions:**
- `0016-dtcg-for-brand-guidelines.md` — use W3C Design Tokens spec, not custom YAML
- `0017-single-grimoire-design-skill.md` — one `grimoire-design` skill, not split (brand/design/figma)
- `0018-figma-mcp-primary-design-input.md` — Figma MCP canonical; HTML/ASCII fallback; no invented design DSL
- `0019-conditional-personas-by-surface.md` — auto-wire review personas by project type (TUI/web/mobile/api); all remain user-invokable
- `0020-grimoire-design-consult-separate.md` — separate skill (not review flag) for technical-consult mode

**New data:**
- `.grimoire/brand/tokens.json` — DTCG-formatted brand tokens (colors, type, spacing, motion, elevation, logo, favicon paths)
- `.grimoire/brand/voice.md` — voice/tone w/ do/don't examples
- `.grimoire/docs/components.md` — lazy-populated component inventory (first design-skill invocation)
- `.grimoire/changes/<id>/designs/preview.html` — static HTML preview per change (when HTML fallback used)
- `.grimoire/changes/<id>/designs/problem.md` — problem statement, user flow, success metrics

**Config schema additions** (`.grimoire/config.yaml`):
- `project.surface: tui | web | mobile | api | mixed` (drives conditional persona selection)
- `project.design_tool.mcp` — MCP server block (auto-populated when user picks Figma at onboarding)
- `project.brand_dir` — defaults to `.grimoire/brand/`

## Assumptions

1. **Figma Dev Mode MCP** (GA mid-2025) is the canonical design-tool MCP for read-only frame/token extraction. [evidence: research confirmed, May 2026]
2. **DTCG (W3C Design Tokens) spec** is stable enough to commit to as the brand format. [evidence: Style Dictionary, Tokens Studio, design-extract all use it]
3. **Designers will pair with a terminal-comfortable user** for grimoire operations this pass. [unvalidated — confirmed w/ user, acceptable for v1]
4. **Component-library detection is feasible via grep + heuristics** (shadcn config files, Storybook config, MUI imports). [unvalidated — needs prototype]
5. **`axe-core` + CSS token-compliance lint provide meaningful cheap fidelity signal** without full headless browser harness. [evidence: axe-core widely used; token-lint = simple regex]
6. **Problem-statement framework menu (JTBD / Lean UX / HMW / PR-FAQ) is sufficient** — no single mandated framework. [user delegation, soft gate w/ semi-aggressive warning]
7. **3 design variants is the right default** for `grimoire-design` per generation cycle. [user delegation, overridable]
8. **HTML preview is static and embedded** — no dev server, no live reload required. [user-confirmed]

## Pre-Mortem

If this change has caused a production incident 6 months from now, plausible failure modes:

1. **Designers get blocked by terminal UX** — they try grimoire alone, can't navigate CLI, abandon. *Mitigation:* documentation explicitly frames "pair with developer for v1"; track if real designer onboarding succeeds before investing in GUI.
2. **Figma MCP scope is wrong** — read-only is too limited (designers want to push generated frames back) OR too broad (write access introduces canvas corruption risk). *Mitigation:* ship read-only, gather feedback for v2.
3. **Brand tokens JSON drifts from actual UI code** — designers update tokens.json but devs never sync to CSS variables. *Mitigation:* brand-lint mode runs in `grimoire-precommit-review`; CI hook optional.
4. **Conditional persona selection misroutes** — TUI project gets web-only review and misses keyboard-nav concerns (or vice versa). *Mitigation:* user-overridable; `project.surface: mixed` fallback runs all personas.
5. **Adversarial persona becomes noise generator** — flags every design w/ accessibility findings, materiality gate fails to trim. *Mitigation:* steel-man + briefing-anchor rules from existing persona engine apply; tune severity calibration in reference.
6. **Generated Gherkin scenarios are low-quality** — auto-generation produces literal "When loading appears" scenarios that devs delete. *Mitigation:* always present for user review; default to "propose, don't commit"; iterate on scenario templates per state.
7. **DTCG choice ages poorly** — W3C spec stalls or splinters, ecosystem moves to alternative format. *Mitigation:* tokens.json is a single file; converter to next-gen format is hours not days; adopt explicit version field.

## Prior Art

Research conducted across two dimensions during drafting:

**Existing UI/UX skills (build-vs-buy):**
- Anthropic official: `frontend-design`, `canvas-design`, `brand-guidelines` skills (high credibility, narrow scope — generation, not workflow)
- `bergside/awesome-design-skills` — 67 SKILL.md files, closest format match to grimoire; **borrow tokens and a11y patterns**
- `skill.design` Figma bundle — Design System Auditor, Accessibility Checker (WCAG 2.2); Figma-MCP-native
- `rohitg00/awesome-claude-code-toolkit/accessibility-specialist.md` — drop-in persona candidate
- shadcn-ui MCP, Storybook MCPs, `design-extract` (2.6k stars) — component/token sourcing

**Decision: hybrid build** — adopt Figma MCP + design-extract + axe-core as external deps; build grimoire-design and grimoire-design-consult skills as integration layer; borrow persona structure from accessibility-specialist; reference bergside patterns.

**Spec-driven dev landscape (frameworks that integrate design):**
- AWS Kiro — only mainstream SDD tool naming `design.md`; prose only, no linked files
- GitHub Spec Kit, Tessl, OpenAI Codex — no design phase
- W3C Design Tokens + Style Dictionary — strongest "design as verifiable spec" example; adopted as brand format
- Applitools/Chromatic — visual diff inside Gherkin `Then` clause; cited as future direction, not v1
- Figma Code Connect — design↔code contract; complementary, not adopted

**Gap confirmed:** no framework bridges Figma frames → Gherkin scenarios → tasks. Grimoire fills this gap.

**Not adopting:**
- v0, Galileo, Uizard (prompt-to-UI, not spec-driven)
- UsiXML / model-based UI dev (dormant academic)
- Pixel-diff harnesses (Chromatic, Percy, Applitools Eyes) — too expensive for v1; revisit as opt-in plugin

## Open Questions

Carried forward; flagged for plan/review stages:

- **Q1.** Component-library detection mechanism — config flag (`project.component_library: shadcn`) vs. heuristic (grep `components.json`, `tailwind.config.js`)? Resolve in plan stage.
- **Q2.** HTML preview rendering — static file in `.grimoire/changes/<id>/designs/preview.html` opens locally; should grimoire CLI offer `grimoire preview <change-id>` to serve via local port? Defer to v2.
- **Q3.** Brand-lint scope — does it run on generated HTML preview only, or also on staged code in `grimoire-precommit-review`? Lean toward both; confirm with reviewer.
- **Q4.** Adversarial persona — single configurable persona w/ multiple "modes" (screen-reader / keyboard / low-bandwidth) or distinct personas? Lean toward single persona w/ conditional sub-checks based on `project.surface`.

## Routing

After this change is approved:
1. `grimoire-plan` — break into implementation tasks (skill SKILL.md files, reference files, init.ts/config.ts changes, brand schema validation, MCP wiring)
2. `grimoire-review` — mandatory at level 4; expect Product Manager + Senior Engineer + Security + QA + Data personas
3. `grimoire-apply` — implement in stages: references first, then skills, then onboarding integration, then review extensions
