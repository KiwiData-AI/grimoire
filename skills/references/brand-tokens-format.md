# Brand Tokens Format Reference

Loaded by `grimoire-design` (variant generation, lint mode) and any review skill running visual-fidelity checks. Defines the on-disk shape of `.grimoire/brand/tokens.json` and the voice/tone file beside it.

The format is **W3C Design Tokens (DTCG) JSON** — an emerging standard supported by Tokens Studio (Figma plugin), Style Dictionary (compiler), and design-extract (URL scraper). See ADR-0016 for the format decision.

---

## File Layout

```
.grimoire/brand/
  tokens.json     # DTCG-format design tokens (colors, typography, spacing, etc.)
  voice.md        # Markdown voice/tone — DTCG does not cover prose
```

`brand_dir` in `.grimoire/config.yaml` can override the location; default is `.grimoire/brand`.

---

## DTCG Basics

Every leaf token is an object with `$value` and `$type`. Optional `$description` documents intent. Nesting creates groups.

```json
{
  "color": {
    "primary": {
      "$value": "#0066ff",
      "$type": "color",
      "$description": "Brand primary — links, primary buttons, focus rings"
    }
  }
}
```

Group nodes (objects without a `$value`) carry no metadata themselves — they organize children. Names use kebab-case or camelCase consistently across a file; do not mix.

### Token types used by grimoire-design

| `$type` | Example `$value` | Used for |
|---|---|---|
| `color` | `"#0066ff"`, `"rgb(0,102,255)"`, `"{color.primary}"` | Backgrounds, text, borders |
| `dimension` | `"8px"`, `"1rem"` | Spacing, sizing, border-radius |
| `fontFamily` | `"Inter, sans-serif"`, `["Inter", "system-ui"]` | Typography stacks |
| `fontWeight` | `400`, `"bold"` | Weight tokens |
| `number` | `1.5`, `1.2` | Line-height ratios, opacity |
| `duration` | `"200ms"` | Motion timing |
| `cubicBezier` | `[0.4, 0, 0.2, 1]` | Motion easing |
| `shadow` | `{ "color": "...", "offsetX": "...", ... }` | Elevation |
| `asset` *(grimoire extension)* | `"./assets/logo.svg"` (path relative to repo root) | Logo and favicon paths |

References use `{group.subgroup.name}` syntax: `"$value": "{color.primary}"` resolves to the token at `color.primary`.

---

## Required Groups (for grimoire-design consumption)

A `tokens.json` that grimoire-design treats as "captured" must include at least one token in each:

- `color.*` — at minimum `color.primary`. Strongly recommended: `color.secondary`, `color.accent`, `color.background`, `color.text`
- `font.family.*` — at minimum `font.family.base`. Often also `font.family.heading`, `font.family.mono`
- `font.size.*` — at minimum `font.size.base`. Scale tokens (`xs`, `sm`, `md`, `lg`, `xl`) are conventional
- `spacing.*` — at minimum `spacing.base` (the unit step, e.g. `8px`). Scale tokens preferred

Missing required groups → grimoire-design generates a warning and falls back to neutral defaults for that group.

## Optional Groups

- `motion.*` — `duration`, `easing` tokens
- `elevation.*` or `shadow.*` — shadow stacks for cards, modals, etc.
- `border-radius.*` — corner radii (e.g. `sm: 4px`, `md: 8px`, `pill: 9999px`)
- `breakpoint.*` — responsive breakpoints (web surface only)
- `asset.logo`, `asset.favicon` — see Logo / Favicon Convention below

---

## Complete Minimal Example

```json
{
  "color": {
    "primary":    { "$value": "#0066ff", "$type": "color" },
    "secondary":  { "$value": "#6b7280", "$type": "color" },
    "accent":     { "$value": "#f59e0b", "$type": "color" },
    "background": { "$value": "#ffffff", "$type": "color" },
    "text":       { "$value": "#111827", "$type": "color" }
  },
  "font": {
    "family": {
      "base":    { "$value": "Inter, sans-serif",          "$type": "fontFamily" },
      "heading": { "$value": "Inter, sans-serif",          "$type": "fontFamily" },
      "mono":    { "$value": "JetBrains Mono, monospace", "$type": "fontFamily" }
    },
    "size": {
      "base": { "$value": "16px", "$type": "dimension" },
      "sm":   { "$value": "14px", "$type": "dimension" },
      "lg":   { "$value": "20px", "$type": "dimension" }
    }
  },
  "spacing": {
    "base": { "$value": "8px",  "$type": "dimension" },
    "sm":   { "$value": "4px",  "$type": "dimension" },
    "lg":   { "$value": "16px", "$type": "dimension" }
  },
  "asset": {
    "logo":    { "$value": "./brand/logo.svg",    "$type": "asset" },
    "favicon": { "$value": "./brand/favicon.ico", "$type": "asset" }
  }
}
```

---

## Logo / Favicon Convention

DTCG does not standardize asset references. Grimoire stores them under `asset.*` with `$type: "asset"` and a path **relative to repo root**. Tools that don't understand `$type: "asset"` ignore the node — safe to round-trip.

```json
"asset": {
  "logo":         { "$value": "./brand/logo.svg",      "$type": "asset" },
  "logo-dark":    { "$value": "./brand/logo-dark.svg", "$type": "asset" },
  "favicon":      { "$value": "./brand/favicon.ico",   "$type": "asset" },
  "favicon-svg":  { "$value": "./brand/favicon.svg",   "$type": "asset" }
}
```

---

## Voice / Tone (`voice.md`)

Voice and tone are prose — DTCG does not cover them. Store as markdown alongside `tokens.json`:

```markdown
# Voice & Tone

## Voice (always)
- Direct, plain language. No marketing fluff.
- Active voice. Short sentences.
- Confident, not boastful.

## Tone (varies by context)
- Onboarding: warm, inviting
- Errors: calm, blameless, with a concrete next step
- Success: brief acknowledgement, no celebration confetti

## Do
- "Save changes" → action verb, present tense
- "Couldn't reach the server. Retry?" → blameless, actionable

## Don't
- "Awesome! You're crushing it!" → over-celebratory
- "An error has occurred." → vague, no recovery path
```

Sections `## Do` and `## Don't` are required; everything else is suggested structure. The Anthropic `brand-guidelines` skill convention is the source.

---

## Round-Trip with External Tools

The format is designed to flow between tools without modification:

- **Tokens Studio (Figma plugin)** — exports Figma Variables to DTCG JSON. Drop the export at `.grimoire/brand/tokens.json` and grimoire-design reads it.
- **Style Dictionary** — compiles DTCG JSON to CSS custom properties, iOS/Android constants, JS modules. Point its source to `.grimoire/brand/tokens.json`; targets go wherever the project builds.
- **design-extract** — scrapes a live URL and emits DTCG JSON. Pipe its output to `.grimoire/brand/tokens.json` to bootstrap from an existing site.

Round-trip rule: external tools may rewrite the file; grimoire reads only `$value`, `$type`, `$description`. Unknown keys (e.g. `$extensions` from Tokens Studio) are preserved on read but not consumed.

---

## Validation Tips (for AI agents)

When reading `tokens.json`:

1. **Parse error** → emit one-line "tokens.json malformed at `<path>` — `<parse-error>`" and continue without brand grounding. Do not crash the workflow.
2. **Missing `$value`** on a leaf node → log "skipping token `<dotted.path>` — missing `$value`". The leaf is invalid; siblings still load.
3. **Malformed hex** (`$type: "color"` with `$value` not matching `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/` or `rgb(...)` / `hsl(...)`) → log and skip.
4. **Unresolved reference** (`{color.primary}` where `color.primary` does not exist) → log and treat as literal string; do not infinite-loop.
5. **Circular reference** (A → B → A) → break at first revisit; log "circular token reference at `<path>`".

When writing `tokens.json`:

- Always include `$type` on every leaf. Tools that compile to typed targets need it.
- Normalize hex to lowercase, 6-digit form. `#0066FF` → `#0066ff`. Keeps diffs clean.
- Sort keys alphabetically within each group. Keeps round-trips with Tokens Studio stable.
