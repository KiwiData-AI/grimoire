# Visual Fidelity Reference

Shared visual-fidelity check engine used by `grimoire-review` (design-phase HTML previews), `grimoire-pr-review` (PR diff), and `grimoire-precommit-review` (staged diff).

The calling skill is responsible for:
- Resolving the **scope** (HTML preview files in `.grimoire/changes/<id>/designs/` vs changed CSS/markup in a diff)
- Invoking this engine at the appropriate workflow step (§5.5 in all three review skills)
- Folding the engine's report under the "Visual Fidelity" section of the final review report

This reference defines: when to run, scope per phase, the token-compliance lint algorithm, axe-core invocation, report format, gating rules, and edge-case handling.

---

## 1. When to Run

Engage the visual-fidelity engine when **either** is true:

- `.grimoire/brand/tokens.json` exists (brand tokens are defined; drift is checkable)
- The change has design artifacts: any file under `.grimoire/changes/<id>/designs/` (HTML preview, ASCII variants, problem.md, etc.)

If neither holds, skip silently — no report section, no noise. This is not an error state; it is a project that has not opted into brand tokens or generated designs.

---

## 2. Scope per Phase

The scope changes by which skill invokes the engine.

### Design phase (`grimoire-review`)

- **Target**: HTML preview files in `.grimoire/changes/<id>/designs/preview.html` (and any `variant-{n}.html`)
- **Rationale**: No code exists yet — the design is the artifact under review. Token compliance and a11y are evaluated against the rendered HTML preview.
- **Skip when**: No `designs/*.html` files exist (e.g., ASCII-only or Figma-only variants — token compliance still runs against the variants markdown if hex values appear; a11y is N/A).

### Code phase (`grimoire-precommit-review`, `grimoire-pr-review`)

- **Target**: Staged diff (precommit) or PR diff (pr-review) — specifically the hunks touching CSS files, SCSS, CSS-in-JS strings, inline `style=` attributes, and HTML/JSX with `class` or `style` content.
- **Rationale**: Brand drift is a code-time concern once implementation begins. Catch it before merge, not at design re-review.
- **Skip when**: Diff touches no styling surface (e.g., pure backend / config / docs change).

---

## 3. Token-Compliance Lint Algorithm

The algorithm is the same as `grimoire-design --lint`. The reference here is the canonical source — the design skill's lint mode and all three review skills run identical logic.

### 3.1 Load tokens

1. Read `.grimoire/brand/tokens.json`.
2. Parse as DTCG (see `./brand-tokens-format.md`).
3. Build a lookup index: `{ "#0066ff" → "color.primary", "Inter, sans-serif" → "font.family.base", "8px" → "spacing.base", ... }`. Normalize hex to lowercase, six-digit form; normalize px-as-integer where possible.
4. On parse failure or any token missing `$value`: emit the malformed-token report (§6 Gating) and exit the engine. Do not proceed to scan.

### 3.2 Scan target files

For each file in scope (per §2):

- **Hex colors**: regex `#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b` — capture every match with file path + line number.
- **px values**: regex `\b\d+(\.\d+)?px\b` — capture font-size, spacing, border, etc.
- **font-family strings**: parse CSS `font-family:` declarations and JSX `fontFamily:` props; capture the quoted family list.

### 3.3 Edge-case suppression (false-positive prevention)

Skip the following matches — they are token-referencing CSS, not drift:

- Inside `var(--...)` — e.g., `color: var(--color-primary)` does not contain a literal hex.
- Inside an SCSS variable declaration that itself is the token source — e.g., `$color-primary: #0066ff;` in a generated tokens file. Detect: file path matches `**/tokens.{scss,css}` or `**/_tokens.scss`, or the file is the generated output of Style Dictionary.
- Inside a comment (`//`, `/* */`, `<!-- -->`) — the lint targets active rules, not annotations.
- Inside a string in a non-style context — e.g., a JS string literal `"see #0066ff for an example"` in a Markdown blockquote within JSX. Heuristic: skip matches whose surrounding context is not a CSS rule, inline `style=`, or known styling prop name (`color`, `background`, `borderColor`, `fill`, `stroke`, `fontFamily`, `fontSize`).
- Already-token CSS custom properties: `--color-primary: #0066ff;` in a stylesheet that defines the tokens is the source of truth, not drift. Same file-path heuristic as the SCSS variable case.

When in doubt, prefer false-negative over false-positive. A noisy lint gets disabled; a quiet one stays on.

### 3.4 Suggestion synthesis

For each surviving hardcoded value, find the nearest token in the index:

- **Exact match**: `#0066ff` matches `color.primary` exactly → suggest `var(--color-primary)`.
- **Near match** (color): compute ΔE76 (Euclidean distance in Lab space) or a cheap Euclidean in sRGB; if any token is within 5% → suggest with a "near match" note ("`#0066fe` ~ `var(--color-primary)` (#0066ff)").
- **Px values**: nearest spacing or font-size token; suggest with the token name.
- **font-family**: substring match against any font-family token's value.
- **No match**: emit the finding but suggest "add a new token in `tokens.json` or pick the closest existing token manually" — do not invent a token name.

### 3.5 Output format per finding

```
- **[suggestion]** `<file>:<line>` hardcoded `<value>` — replace with `var(--<token-path>)` (<note if near match or no match>)
```

Severity is **suggestion** by default. Promote to **blocker** only when the project's `tokens.json` is referenced by an active ADR as the canonical source (briefing axis — brand-system enforcement) AND the value appears in a primary surface (not a one-off test fixture or sandbox).

### 3.6 Clean state

If zero drift findings: emit `No brand drift detected across N files scanned.` Do not emit an empty section header — keep the report clean.

---

## 4. axe-core Invocation

axe-core runs accessibility checks against rendered HTML. It is **opt-in** — never auto-installed by this engine.

### 4.1 Availability check

Before invoking, check (in order):

1. `npx --no-install axe-core --version` exits 0 → axe-core resolvable in the local `node_modules` or up the tree.
2. `axe-core` listed in `package.json` `devDependencies` or `dependencies`.
3. `@axe-core/cli` listed in `package.json`.

If none: emit a single line under the Visual Fidelity section and skip the a11y portion entirely:

```
axe-core not installed — install `@axe-core/cli` for accessibility checks.
```

Do NOT run `npm install`, do NOT prompt the user to install, do NOT fall back to a hosted service. The engine respects the user's tooling choices.

### 4.2 Invocation

When axe-core is available and the scope includes HTML files:

- Design phase: `npx axe <designs/preview.html>` (and per-variant if multiple)
- Code phase: skip axe-core unless the diff modified a rendered preview file the project already maintains. Do not spin up a headless browser to render JSX from a diff — that is out of scope for the cheap tier.

### 4.3 Output format per finding

Map axe-core's JSON output to the same finding shape:

```
- **[<severity>]** [axe-<rule-id>] <file> — <description>. Impact: <minor|moderate|serious|critical>.
```

axe-core severity maps directly: `minor`/`moderate` → suggestion; `serious`/`critical` → suggestion by default, blocker if `project.compliance` lists WCAG / ADA / EAA / Section 508 (regulator anchor — same rule as `./adversarial-personas.md` §Severity Calibration).

### 4.4 Clean state

If axe-core ran and found nothing: `axe-core: no violations.`

---

## 5. Report-Section Format

The engine returns a single Markdown block the calling skill folds into the report under `## Visual Fidelity`:

```markdown
## Visual Fidelity

### Token Compliance
- **[suggestion]** `src/components/Header.tsx:42` hardcoded `#0066ff` — replace with `var(--color-primary)`.
- **[suggestion]** `src/components/Header.tsx:58` hardcoded `16px` — replace with `var(--spacing-base-2x)`.
(or: "No brand drift detected across 12 files scanned.")

### Accessibility (axe-core)
- **[suggestion]** [axe-color-contrast] `designs/preview.html` — Element has insufficient color contrast of 3.8 (foreground color: #888888, background color: #ffffff). Impact: serious.
(or: "axe-core: no violations.")
(or: "axe-core not installed — install `@axe-core/cli` for accessibility checks.")
```

Omit subsections that have nothing to report (no findings + skip-state). If the entire section has nothing to report (clean tokens + axe-core unavailable + nothing in scope), omit the `## Visual Fidelity` header from the report entirely.

---

## 6. Gating Rules

### 6.1 Absent tokens.json

If `.grimoire/brand/tokens.json` does not exist AND the change has design artifacts:

- Token-compliance section: skip silently. Do not emit "no tokens — skipped" noise.
- Accessibility section: still runs (axe-core works without tokens).
- This is the standard greenfield-design state.

If `.grimoire/brand/tokens.json` does not exist AND there are no design artifacts: the engine should not have been invoked at all (per §1). The calling skill is responsible for the gate; the engine assumes the gate already passed.

### 6.2 Malformed tokens.json

If `tokens.json` exists but fails to parse, or any token is missing `$value`:

```markdown
## Visual Fidelity

tokens.json malformed at `.grimoire/brand/tokens.json` — <parse error description>. Fix or remove to enable visual-fidelity checks.
```

Exit the engine for the code-phase invocations (this is a misconfiguration the user must fix; downstream lint cannot proceed). For the design-phase invocation, continue with the accessibility section only — a malformed tokens file should not block reviewing a freshly generated design.

This mirrors `grimoire-design --lint` malformed-token behavior (one-line error + parse description, suggest fix). Single source of truth — same behavior in all four invocation sites (design --lint, review §5.5, precommit-review §5.5, pr-review §5.5).

### 6.3 Empty tokens.json

A valid-JSON but token-less file (`{}`) is treated as "no tokens defined" — token-compliance section emits `No brand tokens defined in tokens.json — token compliance skipped.` and proceeds to accessibility.

### 6.4 Surface gating

This engine does NOT consult `project.surface`. Surface gating belongs to the adversarial personas (`./adversarial-personas.md` activation matrix). Visual fidelity runs whenever the §1 conditions hold — a TUI project that has somehow generated an HTML preview will still get linted. The user can skip via the standard "skip visual-fidelity" conversational override.

---

## 7. Edge Cases

- **Multiple preview files**: lint each independently; merge findings into one section, group by file in the report.
- **Tokens defined but no styling files in scope**: emit `No styling files in scope for token compliance.` Do not pretend to have scanned.
- **Generated stylesheet committed in the diff** (e.g., a Tailwind-built CSS file): include in scan only when the file is hand-authored. Auto-detect generated files via standard banner comments (`/* Generated by Tailwind */`, `/* Generated by Style Dictionary */`) and skip; note skipped count in the report.
- **Color in image asset (SVG)**: out of scope for the cheap tier — do not parse SVGs for fill/stroke hex values. The premium tier (future) may add this; v1 documents the gap and moves on.
- **CSS custom property defined in a non-tokens file**: e.g., `--local-padding: 4px` in a component-local stylesheet. Lint the value (`4px` here) against tokens; suggest replacing the local declaration with a token reference if a match exists.
- **Theme variants (light/dark)**: if `tokens.json` defines mode variants per DTCG, the lookup index includes both; a hardcoded value matching either mode is accepted.
