# Adversarial Personas Reference

Loaded by `grimoire-review`, `grimoire-pr-review`, and `grimoire-precommit-review` when the change touches a user-facing surface. Defines the surface-conditional adversarial personas that complement the engineering / product / security personas in `./review-personas.md`.

Each persona inhabits a user the design might fail. Their job is to find the failure paths a happy-path-focused reviewer would miss: the keyboard-only user who can't tab to the submit button, the screen-reader user lost in an unlabelled icon grid, the user on a 3G connection waiting for a 4 MB hero image.

The set engaged on a given review is filtered by `project.surface` (see §Activation Matrix). All personas inherit the project briefing (§1 of `./review-personas.md`), the materiality gate (§2), and the steel-man requirement (§2a).

---

## Persona Catalog

Each persona below names: **identity** (whose constraints they hold), **evaluation criteria** (what they look at), **what triggers a finding** (the concrete observation that becomes feedback).

### Keyboard-Only User

- **Identity**: Power user navigating exclusively via keyboard (Tab, Shift-Tab, arrow keys, Enter, Esc). Mouse unavailable due to RSI, motor impairment, terminal-only environment, or preference for speed.
- **Evaluation criteria**:
  - Every interactive element reachable via Tab in a sensible order
  - Focus indicator visible on every focusable element
  - No keyboard traps (except modal dialogs, which must escape on Esc)
  - Shortcuts documented and consistent (don't shadow OS / browser defaults)
  - Custom controls (combobox, datepicker, drag-drop) implement full keyboard interaction patterns per WAI-ARIA Authoring Practices
- **Triggers a finding**:
  - Click-only handler without keyboard equivalent
  - Focus indicator suppressed (`outline: none` without replacement)
  - Tab order jumps visually unrelated regions
  - Modal dialog cannot be dismissed with Esc
  - Custom dropdown reachable but not operable from keyboard

### Screen-Reader User

- **Identity**: User of VoiceOver (macOS/iOS), NVDA (Windows), JAWS (Windows), or TalkBack (Android). Navigates by reading aloud announcements; relies on semantic markup and ARIA.
- **Evaluation criteria**:
  - Semantic HTML used in preference to ARIA (`<button>` not `<div role="button">`)
  - Every form input has a programmatically-associated label
  - Icons that convey meaning have accessible names (`aria-label` or visually-hidden text)
  - Dynamic content changes are announced (live regions or focus shifts)
  - Heading hierarchy is meaningful (H1 once, H2 sections, no skipped levels)
  - Image alt text describes meaning, not appearance (decorative images: `alt=""`)
- **Triggers a finding**:
  - Icon-only button without accessible name
  - Form field with placeholder used as the only label
  - Live error announcement missing (form submit → silent failure)
  - Decorative SVG read aloud as a long filename
  - `<div onclick>` instead of `<button>`

### Low-Vision / Color-Blind User

- **Identity**: User with low vision (uses browser zoom 200%+, OS magnifier), or color vision deficiency (deuteranopia, protanopia, tritanopia, monochromacy — affects ~8% of men, ~0.5% of women).
- **Evaluation criteria**:
  - Body text contrast ≥ 4.5:1 (WCAG AA)
  - UI component contrast ≥ 3:1 vs adjacent
  - Information not conveyed by color alone (status badges have icons or text; error fields have text labels not just red borders)
  - Page reflows cleanly at 200% zoom (no horizontal scroll, no overlapping content)
  - Text scales when user adjusts browser font size (no fixed `px` font sizes on body text where `rem` would work)
- **Triggers a finding**:
  - Gray text on white below 4.5:1 (the perennial offender)
  - Red/green status indicator with no icon or text differentiator
  - Layout breaks at 200% zoom (content cut off, controls overlap)
  - Required-field marker conveyed only by red asterisk color (no actual asterisk character)

### Touch-Target User

- **Identity**: Mobile user, often one-handed, often with imprecise thumb input (in motion, accessibility-impaired motor control, or just normal use on a small screen).
- **Evaluation criteria**:
  - Interactive targets ≥ 24×24 CSS pixels (WCAG 2.2 AA minimum); ≥ 44×44 preferred (iOS HIG)
  - 8px+ spacing between adjacent targets
  - Primary actions reachable in the thumb zone (bottom half of phone screen)
  - No hover-only affordances (hover doesn't exist on touch)
  - Long-press, swipe, pinch interactions have a tap-only equivalent
- **Triggers a finding**:
  - Buttons sized below 24×24 in the actual rendered design
  - Adjacent links in a list with no spacing (mis-tap risk)
  - Primary CTA in the top-right corner (unreachable for one-handed use on large phones)
  - Tooltip is the only source of help text on a touch surface

### Responsive-Breakpoint User

- **Identity**: User on a viewport the designer didn't focus-test — 320px-wide phones, foldables in their open state, 5K desktops, browser windows the user resized.
- **Evaluation criteria**:
  - Layout works from 320px viewport width upward (smallest common phone)
  - No horizontal scroll except for content where scrolling is intentional (tables, code blocks)
  - Breakpoints handle landscape phone orientation (short, wide viewports)
  - Text remains readable line length (45-75 characters) across breakpoints — does not stretch to full ultra-wide width
  - Touch targets remain ≥ 24×24 at the smallest breakpoint
- **Triggers a finding**:
  - Card layout breaks below 360px (content overflows or overlaps)
  - Sidebar that collapses to a hamburger but the hamburger button is itself 12×12
  - Line length unconstrained on ultra-wide displays (text spans 2000px)
  - Modal dialog wider than the viewport, requiring horizontal scroll inside the modal

### RTL / i18n User

- **Identity**: User of a right-to-left script (Arabic, Hebrew, Persian, Urdu) or a language with different text expansion (German, Finnish — typically 30% longer; Chinese, Japanese, Korean — often shorter but with line-break rules).
- **Evaluation criteria**:
  - Layout mirrors correctly under `dir="rtl"` (logical properties used: `margin-inline-start` not `margin-left`)
  - Icons that imply direction (arrows, chevrons) flip; icons that don't (clock, magnifying glass) don't
  - Strings interpolated with placeholders use named/positional substitution, not concatenation
  - Hardcoded strings flagged; user-visible text comes from a translation catalog
  - Date, number, currency formats use the user's locale
- **Triggers a finding**:
  - User-visible string hardcoded in the markup (not extracted for translation)
  - Layout breaks visually under `dir="rtl"` (margins on the wrong side, icons not mirrored)
  - Date displayed as `MM/DD/YYYY` without locale awareness (ambiguous globally)
  - String concatenation that won't translate cleanly: `"You have " + count + " items"` → use a translation function with placeholders

### Low-Bandwidth / Offline User

- **Identity**: User on slow or intermittent network (3G, congested wifi, satellite, train tunnel). Frequent in markets the project may not actively target but where users still exist.
- **Evaluation criteria**:
  - Total payload weight for first meaningful render reasonable for the surface (web < 200 KB JS gzipped is a starting bar; mobile native should function offline-first for read paths)
  - Images sized to actual display dimensions; modern formats (AVIF, WebP) with fallbacks
  - Network failures fail gracefully (cached state, queued writes, retry with backoff)
  - Loading states address slow connections, not just fast ones (skeleton at 100ms, escalated message at 5s)
- **Triggers a finding**:
  - Hero image > 1 MB without responsive `srcset`
  - Form submit hangs indefinitely when network is dropped (no timeout, no queue)
  - Critical content loaded via blocking JS bundle > 500 KB
  - No offline state — app crashes or shows blank screen when network is lost

### Hostile Actor

- **Identity**: User actively trying to misuse the design — abuse a flow, exfiltrate data, deceive other users via the system, or weaponize the UI as part of a social-engineering attack. Adversarial UX, not just adversarial security.
- **Evaluation criteria**:
  - User-generated content is escaped and rendered safely (no XSS, no markdown that smuggles HTML)
  - Rate limits visible to legitimate users (so they understand why an action was blocked) but unbypassable
  - Sharing / impersonation features have abuse mitigation (report button, mute, block)
  - Display-name fields don't accept Unicode lookalikes that impersonate other users (homograph attack)
  - Email / SMS templates can't be hijacked for phishing-by-proxy (user-supplied URL appearing in an authority-branded message)
  - Sensitive actions require recent re-authentication, not just an open session
- **Triggers a finding**:
  - Comment field renders user-supplied HTML
  - Search field reflects input back into the page without escaping
  - Profile URL accepts `javascript:` scheme
  - "Invite via email" feature sends arbitrary user-supplied text from the project's domain

### API Conventions Reviewer

- **Identity**: API consumer (internal team, partner, third-party developer). Evaluates the *design* of public APIs the same way users evaluate UI — for consistency, predictability, and minimum surprise.
- **Evaluation criteria**:
  - REST: resource-oriented URLs, correct HTTP verbs and status codes, consistent error envelope, predictable pagination
  - GraphQL: schema follows naming conventions (camelCase fields, PascalCase types), no over-fetching defaults, deprecation flow uses `@deprecated` not removal
  - Idempotency: PUT and DELETE are idempotent; POST that should be idempotent uses an `Idempotency-Key` header
  - Versioning: breaking change has a versioning plan (URL path, header, or media type — but consistent across the API)
  - Discoverability: spec is published (OpenAPI, GraphQL introspection); errors point to docs
- **Triggers a finding**:
  - New `POST /deleteUser` endpoint (verb in URL — should be `DELETE /users/:id`)
  - Inconsistent error envelopes across endpoints (some `{ error: "..." }`, some `{ message: "..." }`)
  - Breaking change to a documented field with no version bump or deprecation notice
  - 200 OK returned for an operation that failed (status code masks the error)

---

## Activation Matrix

Engagement of each persona is determined by `project.surface`. The matrix below comes from ADR-0019.

| Persona | TUI | Web | Mobile | API | Mixed |
|---|---|---|---|---|---|
| Keyboard-only | required | required | n/a | n/a | required |
| Screen-reader | n/a | required | required | n/a | required |
| Low-vision / color-blind | n/a | required | required | n/a | required |
| Touch-target | n/a | n/a | required | n/a | required |
| Responsive-breakpoint | n/a | required | n/a | n/a | required |
| RTL / i18n | conditional | conditional | conditional | n/a | conditional |
| Low-bandwidth / offline | n/a | required | required | conditional | required |
| Hostile actor | required | required | required | required | required |
| API conventions | n/a | n/a | n/a | required | required |

**Legend**:
- **required** — persona engages by default on this surface
- **conditional** — persona engages only when a project briefing axis flags it (e.g., `i18n` tag has count > 0 in the feature inventory; project compliance includes a region requiring RTL)
- **n/a** — persona does not engage by default; user can still invoke via `--personas=...`

**User override always available** via `--personas=keyboard,low-vision` or "skip <persona>". Surface is the default; the user is the override.

**Mixed surface** runs the union of all surface-specific personas. Projects that genuinely span TUI + web + mobile should set `surface: mixed`; that is the cost of breadth.

**Unknown surface** (config field absent) falls back to `mixed`. Better to over-engage than to silently skip critical personas.

---

## Materiality Gate Cross-Reference

Every adversarial finding must cite an axis from the Project Briefing (§1 of `./review-personas.md`). The adversarial set extends the briefing axes the original engine considered:

- **Surface axis** (this engine adds it) — TUI vs web vs mobile vs API determines which personas engage at all
- **Brand axis** — if `.grimoire/brand/tokens.json` defines a contrast ratio target, the low-vision persona uses it; otherwise WCAG AA default
- **Compliance axis** — `project.compliance` mentions WCAG, ADA, EAA (European Accessibility Act), Section 508 → screen-reader and low-vision findings escalate from suggestion to blocker by default
- **Threat-surface tags** (existing) — `i18n=N` count > 0 promotes RTL persona from conditional to required; `mobile=N` count > 0 promotes touch-target persona

A finding from any persona below that lacks a briefing anchor is dropped. The full materiality rules from `./review-personas.md` §2 apply unchanged.

---

## Steel-Man Requirement

Per `./review-personas.md` §2a, every adversarial finding must include a steel-man before submission:

- **Steel-man**: "The designer likely chose this because <strongest plausible reason — convention, performance, scope, stage>."
- **Why it still fails**: "Despite that, <concrete harm path tied to a briefing axis — named user impacted, named state, named consequence>."

If either line cannot be completed with substance, the finding is dropped. "An accessibility issue" is not a finding; "screen-reader user submitting the login form receives no audible feedback on validation error — they cannot recover without sighted assistance" is a finding.

Vague harm paths fail this gate. The adversarial personas exist precisely to name specific harms; generic ones are noise.

---

## Severity Calibration

The default for an adversarial finding is **suggestion**. A finding is a **blocker** when *all three* hold (mirroring `./review-personas.md` §2b):

1. **Concrete harm path** — named user (the persona), named trigger, named consequence
2. **Briefing-anchored** — the consequence threatens a briefing axis (surface, compliance, brand contrast target, threat-surface tag)
3. **Not already mitigated** — neighbor code, design-system component, or sibling feature does not already handle it

Adversarial-specific severity rules:

- WCAG AA violations on a project that lists WCAG / ADA / EAA in `project.compliance` → blocker by default (regulator anchor)
- Deceptive patterns (see `./design-heuristics.md` §3) → blocker by default on customer-facing stage; suggestion on internal-tools stage
- Hostile-actor findings with a working harm path → blocker, regardless of stage (security overlap)
- Touch-target findings on a mobile surface where the project ships → blocker if a user couldn't complete a primary task; suggestion if it's a secondary control

Zero findings is a valid outcome. A persona that returns "no material findings under the briefing" is doing its job. The Contrarian pass (§4.8 of `./review-personas.md`) calibrates inflated findings post-hoc.
