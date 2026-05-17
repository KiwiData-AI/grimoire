---
name: grimoire-design
description: Generate UI/UX designs grounded in a stated user problem — variants, component states, brand-token compliance, and derived Gherkin scenarios. Use when the user wants to design, wireframe, mock up, or rethink a UI surface.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-design

Generate UI/UX designs grounded in a stated user problem. Produces variants, enumerates component states, lints for brand drift, and derives Gherkin scenarios that hand off cleanly to `grimoire-draft` and `grimoire-plan`.

This is one skill, not three (see ADR-0017). Brand-drift lint is a *mode* of this skill, not a separate skill — same artifact (`tokens.json`), same skill, different verb.

## Triggers
- User describes UI/UX work: a new screen, a redesign, a flow, a component
- User mentions a design tool by name (Figma) in the context of producing work
- Loose match: contains "design", "wireframe", "ui", "ux", "mockup", "layout", "figma" combined with "new", "draft", "explore", "redesign", or "rethink"

## Routing
- Non-UI behavior change (API, data model, business logic) → `grimoire-draft` directly
- Brand-only updates (new logo, new color, capture missing tokens) → stay here; use `--capture-brand` or `--lint`
- Tech-check before designing ("should I worry about anything?") → `grimoire-design-consult`
- Bug in an existing UI → `grimoire-bug`
- Pure refactor of UI code (no behavior change) → no grimoire artifact; just do it

## Workflow

### 1. Qualify
Is this actually UI/UX work? If the user is asking for an API contract, a data model change, or backend logic with no user-facing surface, route to `grimoire-draft` and stop.

If a `.grimoire/changes/<change-id>/consult.md` exists for this change-id (from a prior `grimoire-design-consult` run), read it now. Parse the `## Inferred assumptions` and `## Inferred givens` sections verbatim — these exact H2 headers are written by `grimoire-design-consult` and must not be paraphrased or fuzzy-matched. Propagate both lists into every subsequent prompt in this workflow. Specifically:

- **Step 6 (Variant Generation)**: exclude patterns that violate any given. For example, if a given says "no JS-heavy patterns due to perf budget", do not produce a variant that relies on client-side state machines. State the exclusion in the affected variant's tradeoff line so reviewers see why the pattern was avoided.
- **Step 9 (Derive Gherkin)**: reference inferred assumptions in scenario preconditions where applicable (e.g., a Given line that mirrors the assumption "user is authenticated before reaching this surface"). Cite givens by their consult.md bullet when a scenario's expected outcome depends on the given.

Carry the open-questions list (also in `consult.md`) forward as warnings — surface unresolved items to the user when they affect a variant choice or scenario, but do not block on them. Open questions are flags, not gates.

### 2. Problem Statement (soft gate)
Ask for the user problem this design addresses. If the user provides one up-front, write it to `.grimoire/changes/<change-id>/designs/problem.md` and continue.

If the user skips or describes the design without a problem (e.g., "make a settings page"), emit the soft-gate warning verbatim:

> No user problem articulated. Generic designs ≈ wasted iteration.
> The most common cause of redesigns is missing problem context.
> Strongly recommend stating the problem first.

Then ask: "Proceed without problem statement? (y/N)". On `y`, log `problem_statement: skipped (user override)` in `problem.md` and continue. On `N` or no answer, offer the framework menu:

| option | format |
|---|---|
| jtbd | When [situation], I want to [motivation], so I can [outcome] |
| lean-ux | Business problem / users / outcomes / solutions / hypotheses |
| hmw | How might we [verb] [user] [outcome]? |
| pr-faq | Press release + FAQ working-backwards |
| freeform | (user writes their own) |

Render the chosen template for the user to fill in. Write the result to `problem.md`.

### 3. User Flow & Success Metrics
Ask for a **friction-log narrative** as the default minimum-viable level — a short prose description of the current user journey and where it hurts. Offer (but never force) two upgrades: Mermaid journey diagram, then service blueprint.

Separately — not bundled — ask "What are the user's current pain points?" Accept a bulleted list, free text, or "none known". Capture pain points in `problem.md` under a dedicated `## Pain Points` section. Variants generated in step 6 must each state which pain points they address (or explicitly mark "deferred").

Ask for at least one measurable success metric (e.g., "reduce support tickets about lockouts by 50%"). If the user cannot articulate one, note `no success metric — design effectiveness will be hard to evaluate` as an assumption in `problem.md`.

### 4. Lazy Component Inventory
If `.grimoire/docs/components.md` is absent AND the project has UI code, ask the user before scanning. On approval, scan for:

- `components.json` (shadcn-ui marker)
- `tailwind.config.{js,ts}` (Tailwind setup)
- MUI / Chakra / Mantine / Radix imports in `package.json`
- `*.stories.{ts,tsx,jsx,js}` (Storybook stories)

Write findings to `.grimoire/docs/components.md` listing detected components with file paths and known variants. Skip the scan entirely if no UI signals are present (greenfield or non-UI surface). Subsequent variants prefer existing components over net-new designs and flag net-new explicitly.

### 5. Brand Grounding
Read `.grimoire/brand/tokens.json` and `.grimoire/brand/voice.md` if they exist. Use the format documented in `../references/brand-tokens-format.md`. Required groups: `color.*`, `font.family.*`, `font.size.*`, `spacing.*`.

**Malformed `tokens.json`**: if JSON parse fails or required `$value` fields are missing, emit a one-line error:

> tokens.json malformed at `<path>` — `<parse-error-description>`. Continuing without brand grounding.

Continue the workflow without brand grounding rather than crashing. Variants will use neutral defaults and the user can fix the file and re-run. Anchor: pre-mortem failure mode #6 — undetected brand drift produces low-quality output, but a crashed skill produces zero output.

**Absent `tokens.json`**: continue silently with neutral defaults. Note in the generated HTML that no tokens were found.

### 6. Variant Generation
Produce **3 variants by default**. Each variant explicitly states the tradeoff it optimizes for (e.g., "minimal clicks", "maximum information density", "progressive disclosure") and lists which pain points from step 3 it addresses.

Output target by precedence — pick the highest-fidelity option available:

1. **Figma MCP** configured (`project.design_tool.mcp` present) → query Figma; reference variants by node ID in `.grimoire/changes/<change-id>/designs/variants.md`
2. **Static HTML** → write `.grimoire/changes/<change-id>/designs/variant-{n}.html` per variant. Self-contained, no CDN. Brand tokens injected as CSS custom properties in `:root` per `../references/design-input-formats.md` §5
3. **ASCII** → inline in `variants.md` for trivial scope (copy change, single-field form, TUI surface) per `../references/design-input-formats.md` §6

If Figma MCP is configured but unreachable, emit one-line "Figma MCP unreachable — `<error>`. Falling back to static HTML." and continue with HTML. Never crash.

Each variant must reference brand tokens from `tokens.json` (if present) and consult `../references/design-heuristics.md` to avoid common omissions (missing feedback, no escape hatch, contrast too low, novel pattern where a standard exists).

When the user requests a revision of a specific variant ("redo variant 2 with a wizard pattern"), regenerate only that variant; leave the others unchanged.

### 7. State Enumeration
For each interactive component in the selected variant, walk the state checklist from `../references/design-heuristics.md` §5:

| state | required? |
|---|---|
| default | yes |
| loading | yes |
| empty | yes |
| error | yes |
| success | conditional (forms, async actions) |
| disabled | conditional (inputs, buttons) |
| readonly | conditional (inputs) |
| over-limit | conditional (rate-limited / quota'd actions) |

If the user attempts to mark the design complete with a required state missing, emit the soft gate:

> Missing `<state>` state. Most "the design didn't work in production"
> complaints trace to missing error / loading / empty handling.

Ask "Skip `<state>` state? (y/N)". On confirm, log the skip as an unvalidated assumption in `manifest.md`. Infer conditional state upgrades from change context — a form submission upgrades `success` to required; a rate-limited action upgrades `over-limit` to required.

### 8. Render Preview
For HTML output, write a single `.grimoire/changes/<change-id>/designs/preview.html` showing each component in each state, side-by-side. Each state is labeled and visually distinct (loading shimmer, error banner, empty placeholder, etc.). Designer opens the file directly in a browser — no `grimoire preview` CLI command exists in v1.

Skip preview rendering when output is Figma (the Figma file IS the preview) or ASCII (the markdown table IS the preview).

### 9. Derive Gherkin
Propose draft `.feature` files at `.grimoire/changes/<change-id>/features/<capability>/`. One Scenario per (component × state). Each Scenario has Given / When / Then steps grounded in the design.

Apply surface-conditional adversarial scenarios per `../references/adversarial-personas.md`:

- `project.surface: web` → keyboard-navigation, screen-reader-announcement, color-contrast scenarios
- `project.surface: mobile` → touch-target-size, gesture-conflict scenarios
- `project.surface: tui` → keyboard-navigation only (no screen-reader, no contrast)

Apply security tags per `../references/security-compliance.md`. Components handling user input get `@input-validation` and at least one negative scenario.

Present the proposed scenarios for review: "Review proposed scenarios — accept, edit, or reject each." Accept all / accept some / edit / reject any. Rejected scenarios do not get written.

### 10. Handoff
When the user accepts proposed scenarios, the change folder is populated. Suggest the next step:

> Run `grimoire-draft` to refine the manifest and ADRs, or `grimoire-plan` to break into tasks.

Skill is done.

## Modes

The flags below are **conversational invocations** the AI interprets, not real CLI subcommands of the `grimoire` binary. Per ADR-0010, skills are pure markdown — there is no executable code behind `--lint`, `--variants=N`, or `--capture-brand`. The AI reads these as user intent and runs the corresponding flow.

### `--capture-brand` / "capture brand" / "capture brand guidelines"
When the user says "capture brand" or invokes `--capture-brand`, run the brand-capture flow using the same prompts as `grimoire init` onboarding (see `src/core/init.ts` `askPreferences()` brand-capture block):

- Ask for primary / secondary / accent color (hex, validated against `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i`; re-prompt on invalid)
- Ask for font family, base font size, base spacing unit
- Optional: logo path, favicon path
- Ask for one Do-example and one Don't-example for voice/tone
- Write `.grimoire/brand/tokens.json` in DTCG format (see `../references/brand-tokens-format.md`)
- Write `.grimoire/brand/voice.md` from the captured do/don't pair

Before writing, glob the repo root for existing `tokens.json` or `design-tokens.json`. If found, ask "Use existing `<path>`? (Y/n)" — on yes, copy it to `.grimoire/brand/tokens.json` instead of prompting from scratch.

Do **not** create `.grimoire/brand/` unless the user has explicitly opted in via this mode or the onboarding flow.

### `--lint` / "lint brand" / "lint brand drift"
When the user says "lint brand" or invokes `--lint`, run the brand-drift lint flow described in the Lint Mode section below.

### `--variants=N` / "give me N variants" / "N variants"
When the user invokes `--variants=N` or says "give me 5 variants", override the default count of 3 in step 6. Accept any positive integer up to 10. Above 10, ask the user to confirm — variants become noise beyond that count.

## Lint Mode

Brand-drift lint cross-references hardcoded values in code against `.grimoire/brand/tokens.json` and suggests token replacements.

### Scope
- Default: scan **staged files** (`git diff --cached --name-only`) — fast, dev-loop-friendly
- `--all` / "scan all" → scan all tracked files (slower; honor `.grimoire/mapignore`)
- File types: `.css`, `.scss`, `.less`, `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte` (configurable per project conventions)

### What it looks for
- Hardcoded color hex values (`#0066ff`, `#06f`, `rgb(...)`)
- Hardcoded `px` / `rem` / `em` values
- Hardcoded `font-family` strings

Each hit is cross-referenced against `tokens.json`. If a near-match exists, emit a suggestion:

> `src/components/Button.css:14` — `#0066ff` matches `color.primary`. Replace with `var(--color-primary)`.

### Clean state
If zero drift is found, emit exactly:

> No brand drift detected across N files scanned.

And exit 0. Do **not** print a long "everything passed" report — clean state is a one-liner. False positives erode trust faster than missed findings.

### Malformed `tokens.json`
Catch JSON parse errors and missing `$value` fields. Emit a one-line error with the parse description and exit non-zero — this is a misconfiguration, not a lint finding:

> tokens.json malformed at `<path>` — `<parse-error>`. Fix or remove.

Do not attempt partial lint with a half-parsed token file.

### Absent `tokens.json`
Clean exit. Emit:

> No brand tokens to lint against. Run `grimoire init` or `grimoire-design --capture-brand` first.

Do not error — absence is a valid state for projects that haven't onboarded brand capture yet.

### Integration
`grimoire-precommit-review` invokes this lint automatically when `.grimoire/brand/tokens.json` exists. The lint logic is also referenced from `../references/visual-fidelity.md` (the shared reference used by `grimoire-review`, `grimoire-precommit-review`, and `grimoire-pr-review` for the visual-fidelity tier).

## Important
- **Pure markdown.** This skill is interpreted by an LLM per ADR-0010. Do not generate executable code or shell scripts to satisfy any step. The variant HTML files are output artifacts; the workflow itself is prose the AI follows.
- **Ask before scanning large codebases.** Component-inventory scans (step 4) and `--lint --all` scans can be expensive on monorepos. Confirm with the user before scanning more than ~500 files.
- **Honor `.grimoire/mapignore`.** Any scan (component inventory, brand lint) must respect mapignore patterns. Reuse the same exclusion logic as `grimoire map`.
- **Do not create `.grimoire/brand/` unprompted.** The directory only appears when the user opts in via onboarding or `--capture-brand`. Reading from a missing brand directory is a valid state — fall back to neutral defaults.
- **Never log Figma access tokens.** The token lives in `FIGMA_ACCESS_TOKEN` env var, read by the MCP server. Never write it to config, never echo it in transcripts, never include it in artifacts.
- **Soft gates are warnings, not blockers.** The problem-statement gate (step 2) and the state-enumeration gate (step 7) warn aggressively but accept user override. Record overrides as assumptions so they surface in review.
- **Brand drift findings are suggestions, not blockers.** Lint mode proposes token replacements; it does not auto-rewrite code. The user decides whether to apply.

## Done
When the user accepts proposed Gherkin scenarios and the change folder contains `problem.md`, `designs/`, and `features/`, the workflow is complete. Suggest `grimoire-draft` (manifest + ADRs) or `grimoire-plan` (task breakdown) next.
