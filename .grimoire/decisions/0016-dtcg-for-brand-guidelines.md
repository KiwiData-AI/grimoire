---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
---

# Use W3C Design Tokens (DTCG) format for brand guidelines

## Context and Problem Statement

Grimoire onboarding needs to capture brand guidelines (colors, typography, spacing, logos, favicons, motion, elevation) in a machine-readable format that:
- AI agents can read to avoid generic "AI-looking" UI
- Tools (Style Dictionary, Tokens Studio, design-extract) can consume/produce
- Designers can edit without learning grimoire-specific syntax
- Survives multi-year format evolution

## Decision Drivers

- Must be a standard, not a grimoire invention — user prefers existing standards over invented YAML
- Must round-trip with Figma (Variables → tokens.json via Tokens Studio plugin)
- Must compile to CSS/iOS/Android (Style Dictionary)
- Must support future-proof token types (motion, elevation, shadow, not just color)
- Must be auditable by humans (JSON, not binary)

## Considered Options

1. **W3C Design Tokens (DTCG) JSON** — emerging W3C standard; `$value`/`$type`/`$description` schema; Style Dictionary + Tokens Studio + design-extract all support it.
2. **Custom grimoire YAML** — consistent with `data.yml`, `context.yml`, `config.yaml`. Familiar to existing grimoire users.
3. **Tailwind config (`tailwind.config.js`)** — common in JS ecosystem but JS-only and Tailwind-specific.
4. **CSS custom properties file** — closest to runtime but lacks semantic metadata (type, description, group).

## Decision Outcome

Chosen option: **W3C Design Tokens (DTCG) JSON** stored at `.grimoire/brand/tokens.json`.

Voice/tone (which DTCG doesn't cover) lives alongside as `.grimoire/brand/voice.md` — a separate markdown file with do/don't examples per Anthropic's `brand-guidelines` skill convention.

### Consequences

- Good: Interop w/ Figma Variables, Style Dictionary, design-extract — no lock-in
- Good: Designers can use familiar tools (Tokens Studio Figma plugin) without learning grimoire syntax
- Good: Future-proof — DTCG covers motion/elevation/shadow that grimoire might want later
- Good: Single canonical source feeds CSS variables, mobile constants, design previews
- Bad: JSON is more verbose than YAML and inconsistent w/ other grimoire config files
- Bad: DTCG spec is still emerging (Editor's Draft as of 2026) — could shift
- Bad: Requires a small reference doc (`brand-tokens-format.md`) since most grimoire users won't know DTCG

### Relationship to ADR-0007 (data schema as YAML)

This decision deliberately inverts ADR-0007's YAML default. The split rule:

- **YAML** — grimoire-internal artifacts (`config.yaml`, `schema.yml`, `context.yml`, `data.yml`, `index.yml`). Consumed only by grimoire and the AI agent reading these files. Human-readable, comments-friendly, terse.
- **JSON (DTCG)** — brand tokens. Consumed by external ecosystems (Figma Tokens Studio plugin, Style Dictionary compilers, design-extract scrapers, CSS-in-JS runtimes). Standard required for round-tripping with design tools.

Decision rule: artifact stays in YAML unless it has a real interop requirement with an existing JSON-native ecosystem. Brand tokens cross that line; no other current artifact does.

### Confirmation

If a designer can edit `.grimoire/brand/tokens.json` via Figma Tokens Studio plugin and the changes are consumed by `grimoire-design` without modification, the decision is validated. Reverse path (token-extract scrapes a live URL, emits compatible JSON, grimoire ingests) is the secondary validation path.
