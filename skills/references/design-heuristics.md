# Design Heuristics Reference

Loaded by `grimoire-design` (variant generation, state enumeration) and review skills running visual-fidelity checks. A compact checklist of the heuristics, laws, and minimum-viable rules an AI agent or reviewer should know before generating or critiquing UI.

The goal is **calibration**, not exhaustiveness. Every heuristic below has a trigger condition — if the trigger doesn't apply to the change under review, skip it. Heuristics fired indiscriminately become noise; the materiality gate from `./review-personas.md` §2 applies here too.

---

## 1. Nielsen's 10 Usability Heuristics

The classic baseline. Each line: heuristic, one-line definition, trigger.

| # | Heuristic | Trigger (when it applies) |
|---|---|---|
| 1 | **Visibility of system status** — keep users informed of what's happening | Any async action; loading > 1s; multi-step flows |
| 2 | **Match between system and real world** — speak the user's language | Naming any concept users will see; error messages |
| 3 | **User control and freedom** — escape hatches, undo, cancel | Any destructive action; multi-step wizards; modal dialogs |
| 4 | **Consistency and standards** — follow platform and product conventions | New component where a similar one exists; reinventing standard controls |
| 5 | **Error prevention** — design out errors before they happen | Forms; destructive actions; irreversible operations |
| 6 | **Recognition rather than recall** — show options, don't make users remember | Multi-step flows; command palettes; settings spread across pages |
| 7 | **Flexibility and efficiency of use** — accelerators for power users | Frequently-used flows; keyboard shortcuts; bulk operations |
| 8 | **Aesthetic and minimalist design** — every extra element competes for attention | Crowded UI; multiple CTAs; decorative elements without purpose |
| 9 | **Help users recognize, diagnose, and recover from errors** — plain language, named cause, suggested fix | Every error path; form validation; API failures |
| 10 | **Help and documentation** — searchable, task-focused, concrete steps | Onboarding; complex features; first-use moments |

Findings cite the heuristic by number: "Violates H#9 — error message names no recovery path."

---

## 2. WCAG 2.2 AA Quick Reference

The minimum bar for any web or mobile UI claiming accessibility. Numbers are AA-level; AAA is stricter and rarely required outside regulated domains.

### Contrast

- **Body text vs background**: 4.5:1 minimum
- **Large text** (≥18pt regular or ≥14pt bold) vs background: 3:1 minimum
- **UI components** (buttons, form borders, focus indicators, icons that convey meaning) vs adjacent colors: 3:1 minimum
- **Tools**: check contrast with a contrast checker; pseudo-disabled or low-emphasis text still must meet 3:1 if it carries meaning

### Target size

- **Minimum interactive target**: 24×24 CSS pixels (WCAG 2.2 added this — was 44×44 in iOS HIG, 48dp in Material)
- **Spacing**: targets smaller than 24×24 must have at least 24px of clear space around them
- **Exceptions**: inline links in body text; user-agent-controlled (native `<select>`); essential controls where size is dictated by the underlying content

### Focus

- Focus indicator must be **visible** on every interactive element
- Focus order must match visual reading order (left-to-right, top-to-bottom for LTR; reverse for RTL)
- No focus traps except in modal dialogs (where trap must be escapable via Esc)

### Forms

- Every input has a programmatically-associated `<label>`
- Required fields are marked beyond color (asterisk, "required" text)
- Errors are announced to screen readers (live region or focus shift) and named in text near the field

### Motion

- No content that flashes >3 times per second (seizure risk)
- Respect `prefers-reduced-motion`; provide a non-animated alternative for essential motion

---

## 3. Deceptive Patterns (Brignull Taxonomy)

Dark patterns to **avoid** in the design, and to **flag** during review. Source: deceptive.design (Harry Brignull's taxonomy). Findings here are usually blockers — the project's stage and audience determine severity, but never normalize them.

### Patterns

- **Roach motel** — easy to get into, hard to get out (e.g. one-click signup, multi-step cancel flow). Trigger: review any sign-up / subscription / account-deletion flow.
- **Confirmshaming** — guilt the user out of opting out (e.g. "No thanks, I hate saving money"). Trigger: any opt-out / decline button.
- **Sneak into basket** — adds items the user did not select (e.g. donation pre-checked, add-on default-enabled at checkout). Trigger: any cart / order-review flow.
- **Hidden costs** — final price revealed only at last step (fees, shipping, taxes appear at checkout). Trigger: any purchase / pricing flow.
- **Forced continuity** — free trial silently rolls to paid without notice. Trigger: any trial / subscription onboarding.
- **Disguised ads** — ads styled to look like content or controls. Trigger: any ad-supported UI.
- **Friend spam** — uses contact list to send unsolicited invites under the user's name. Trigger: any contact-import / referral flow.
- **Privacy zuckering** — tricks users into sharing more data than intended. Trigger: any consent flow, permission prompt, default privacy setting.
- **Misdirection** — uses visual emphasis to distract from a deceptive choice. Trigger: A/B-tested CTA layouts; "recommended" defaults.
- **Trick questions** — confusingly-worded questions where the obvious answer is the opposite of intent. Trigger: any settings toggle, consent checkbox.

### Reviewer rule

For each pattern, ask: "If a regulator (FTC, CMA, EU DSA enforcement) saw this flow tomorrow, would the company defend it or change it?" If the answer is "change it," the pattern is a blocker.

---

## 4. Cognitive Laws (apply when relevant)

Named laws that compress empirical findings about human-UI interaction. Each one is a single sentence plus when to apply it.

- **Fitts's Law** — time to acquire a target is a function of distance and size. *Apply when*: placing primary actions (put them where the cursor / thumb already is, make them large); reviewing dense toolbars.
- **Hick's Law** — decision time grows with the log of the number of choices. *Apply when*: menus with >7 items; settings pages; onboarding step sequences. Reduce, group, or progressively disclose.
- **Miller's 7±2** — short-term memory holds roughly 7 items. *Apply when*: navigation breadth (top-level menu items), groups within a form, items shown without scrolling. Chunk when over the limit.
- **Jakob's Law** — users spend most of their time on other sites. *Apply when*: inventing a new pattern where a standard one exists. Most users expect the search box top-right, the logo top-left, the cart icon top-right, the sign-out under a profile menu. Deviate only with reason.
- **Doherty Threshold** — productivity soars when system response is under 400ms. *Apply when*: any interactive action — feedback within 100ms, completion under 400ms where possible, skeleton/loader for anything longer.
- **Tesler's Law** — every system has irreducible complexity; the question is who absorbs it (user, designer, engineer). *Apply when*: simplifying — never delete complexity, only shift it. Don't push to users what the system can decide.
- **Postel's Law (UI variant)** — be liberal in what you accept, conservative in what you produce. *Apply when*: form inputs (accept "(555) 123-4567" or "5551234567"); display formatting (canonicalize on output).

---

## 5. Empty / Error / Loading State Rules

For every interactive component, the design must address these states. Missing states are the single most common omission in AI-generated UI; treat them as a checklist.

### Required states (all interactive components)

| State | Minimum-viable handling |
|---|---|
| **Default** | The component at rest, ready for input or display. |
| **Loading** | Visible feedback if action takes >300ms. Skeleton, spinner, or progress bar. Never a blank screen. |
| **Empty** | Component is visible but holds no data. Show a brief explanation of what would normally appear and how to populate it (the "zero state"). Never silent. |
| **Error** | Component cannot fulfill its job. Show what went wrong in plain language, with a concrete recovery action (retry, contact, alternative path). Never just "An error occurred." |

### Conditional states (apply per component type)

| State | Applies when | Handling |
|---|---|---|
| **Success** | Action has a meaningful completed state (form submit, file upload) | Brief acknowledgement + next step. No celebration confetti unless the action genuinely warrants it. |
| **Disabled** | Action is unavailable in the current context | Visually muted; tooltip or label explains *why* it's disabled and what would enable it. Never disable without explanation. |
| **Read-only** | Component shows data the user can't edit | Visually distinct from editable (no input border, no cursor); copy-to-clipboard if data is referenceable. |
| **Over-limit** | Input has a max length, count, or quota | Live counter visible at ≥80% capacity; clear feedback when limit is hit and what the user can do (delete, upgrade). |
| **Partial / degraded** | Component depends on a service that's slow or down | Show what's available + named outage explanation; do not pretend everything is fine. |

### Reviewer rule

For each interactive component in the design, walk the four required states. If any is missing, that's a finding — severity depends on the criticality of the component. Login forms missing an error state = blocker. Footer-link list missing a loading state = drop (loading isn't a thing for static content).

---

## Notes for AI Agents Generating UI

- Default to **fewer choices** (Hick) and **standard patterns** (Jakob). The marginal cost of inventing a novel layout almost never beats the marginal cost of users not recognizing it.
- Default to **visible feedback within 100ms** for any interaction. Even a focus-ring change counts.
- Default to **calm, blameless error messages** with a named recovery path. "Couldn't reach the server. Retry?" beats "An error occurred."
- When in doubt about contrast, check; do not estimate. AI-generated palettes routinely miss 4.5:1.
- When in doubt about target size, go to 44×44. The 24×24 minimum is the floor, not the goal.
