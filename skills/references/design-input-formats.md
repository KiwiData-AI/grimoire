# Design Input Formats Reference

Loaded by `grimoire-design` (variant generation) and `grimoire-draft` (Figma snapshot consumption). Defines the input sources grimoire-design can consume, in precedence order, and the fallbacks when none are available.

The precedence is **Figma MCP → other MCPs → static HTML → ASCII**. Higher-fidelity inputs win; lower-fidelity outputs are emitted only when nothing better is available. See ADR-0018 for the Figma-primary decision.

---

## 1. Figma MCP (primary)

When `project.design_tool.mcp` is configured with the Figma server, grimoire-design queries Figma directly for frame data and component metadata.

### Setup

Configured at `grimoire init` time. Stored as:

```yaml
project:
  design_tool:
    name: figma
    mcp:
      name: figma-developer
      command: npx
      args: ["-y", "figma-developer-mcp@latest"]
```

The access token is **never** written to config. The MCP server reads `FIGMA_ACCESS_TOKEN` from the shell environment.

### What to query

- **Frame data** — given a Figma URL or node ID, fetch frame structure (children, sizes, positions). Use for converting a designed screen into a Gherkin scenario set.
- **Variables** — Figma Variables → DTCG tokens. If the project's `.grimoire/brand/tokens.json` is missing and Figma Variables exist, offer to seed `tokens.json` from them via Tokens Studio export.
- **Components** — query the file's components inventory. Cross-reference with `.grimoire/docs/components.md` to detect drift or net-new components.

### Cache

When grimoire-design or grimoire-draft fetches frame data, cache the response at `.grimoire/changes/<change-id>/designs/figma-snapshot.json`. Reuse cache for subsequent skills on the same change-id; refresh on user request.

### Graceful degradation

If the MCP is configured but the call fails (network, expired token, missing file permission):
- Emit one-line "Figma MCP unreachable — `<error>`. Falling back to static HTML."
- Continue with HTML fallback (§4 below). Do not crash the workflow.

---

## 2. shadcn-ui MCP (optional)

When the project uses shadcn-ui (detected via `components.json` or `@radix-ui/*` deps) and the shadcn MCP is installed, grimoire-design can fetch component source by name.

### What to query

- **Component fetch** — given a component name (e.g. `Button`, `DialogClose`), retrieve the canonical source. Use when generating variants to ensure they reference the actual project component shape, not a generic one.
- **Variants list** — enumerate variants the project's component library exposes (e.g. `Button` → `default`, `destructive`, `ghost`, `outline`).

### Activation

Only engaged when `.grimoire/docs/components.md` lists shadcn-ui as the component library. Otherwise skip.

---

## 3. Storybook MCP (optional)

When the project has Storybook (`.storybook/` directory, `*.stories.*` files), the Storybook MCP can extract story metadata.

### What to query

- **Story enumeration** — list all stories with their args, controls, and parameters. Use to derive states per component (default / loading / empty / error).
- **Story rendering** — for a given story, fetch the rendered HTML snapshot (if Storybook is running locally with the addon installed).

### Use case

The richest source of per-component state coverage. When available, prefer over manually enumerating states in §9 of the grimoire-design workflow.

---

## 4. design-extract (optional)

URL-to-tokens scraper. Given a live site URL, produces DTCG-format `tokens.json`.

### When to use

- Bootstrapping `tokens.json` from an existing site (e.g. migrating to grimoire mid-project)
- Sanity-checking that hand-edited tokens match what's actually on a deployed page

### Output

Writes to stdout or a path; pipe to `.grimoire/brand/tokens.json` (or to a temp file for diffing).

### Limitations

- Computed styles only — no semantic grouping. Output is flat; group manually.
- Misses tokens not present on the scanned page (e.g. error states never rendered).

---

## 5. HTML Fallback

When no MCP is available, grimoire-design emits self-contained static HTML files at `.grimoire/changes/<change-id>/designs/variant-{n}.html`.

### Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Variant 1 — <change-id></title>
  <style>
    :root {
      /* Brand tokens injected from .grimoire/brand/tokens.json */
      --color-primary: #0066ff;
      --color-text: #111827;
      --spacing-base: 8px;
      --font-family-base: Inter, sans-serif;
    }
    body { font-family: var(--font-family-base); color: var(--color-text); }
    .button-primary { background: var(--color-primary); padding: var(--spacing-base); }
    /* ... */
  </style>
</head>
<body>
  <main>
    <!-- Variant markup -->
  </main>
</body>
</html>
```

### Rules

- **Self-contained** — no external CSS, no CDN scripts, no remote fonts. Designer opens the file directly; offline must work.
- **CSS variables only** — every color, spacing, font value must reference a `--token` CSS variable defined in `:root`. The `:root` block is the bridge between `tokens.json` and rendered output.
- **No JS** unless the variant is demonstrating an interaction that can't be shown statically. Prefer multiple HTML files showing each state over one file with JS state toggling.
- **One file per variant** — `variant-1.html`, `variant-2.html`, `variant-3.html` by default. A `preview.html` file at the same level renders all variants × all states in a grid for side-by-side review.

### Token referencing

Generate the `:root` block by reading `.grimoire/brand/tokens.json` and emitting one CSS custom property per token. Mapping rule: `color.primary` → `--color-primary`, `font.family.base` → `--font-family-base`. Dot becomes hyphen, kebab-case throughout.

If `tokens.json` is absent, emit neutral defaults (white background, system font, 8px spacing) and note in a top-of-file comment: `/* No brand tokens — using neutral defaults. Run grimoire-design --capture-brand. */`

---

## 6. ASCII Fallback

For trivial scope (level 1-2 changes touching a single existing component), ASCII art in a markdown table is the right tier. Faster to author and read than HTML for low-stakes layout changes.

### When to use

- Single component, single state change
- Pure layout reordering (no new visual treatment)
- TUI surface (where HTML preview is irrelevant)
- Quick sketch for a consult conversation, not a final spec

### Convention

```markdown
## Variant 1 — login form, error state

| Element        | Layout                              |
|---             |---                                  |
| Header         | [Logo]                  [Help link] |
| Form           | Email:    [____________________]    |
|                | Password: [____________________]    |
|                | [!] Invalid credentials             |
|                | [ Sign in ]      Forgot password?   |
| Footer         | Terms · Privacy · v2.4              |
```

Use `[Element]` for interactive controls, `[!]` for error states, plain text for static labels. Markdown tables keep the structure readable in any viewer.

### When NOT to use

- Web or mobile surface with new visual treatment → use HTML
- Multi-component or multi-state designs → ASCII collapses; use HTML grid
- Anything a designer needs to react to visually → ASCII underspecifies

---

## Selection Rule (precedence)

Grimoire-design picks the highest-fidelity output the environment supports:

1. Figma MCP configured → render in Figma (no local artifact written)
2. shadcn / Storybook MCP available + UI codebase detected → HTML using actual component source
3. Otherwise → static HTML with brand-token CSS variables
4. Override to ASCII only when scope is trivial OR surface is TUI

User can override via conversational invocation: "use HTML" or "give me ASCII". The selection is a default, not a lock.
