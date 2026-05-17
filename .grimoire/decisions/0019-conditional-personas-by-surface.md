---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
---

# Conditionally wire review personas by project surface; keep all available

## Context and Problem Statement

`grimoire-review` currently selects personas by complexity level (§3 of review-personas.md). When designs are added to scope, persona applicability becomes surface-dependent:
- A TUI doesn't need responsive-breakpoint checks but needs keyboard navigation
- A web app needs color contrast and viewport scaling
- An API doesn't need accessibility checks but needs API-design heuristics
- A mobile app needs touch-target sizing (44pt iOS, 48dp Android)

Running every accessibility/design persona on every change produces noise. Running none misses real concerns.

## Decision Drivers

- User stated personas should "conform with the change" — TUI vs website have different relevant personas
- Existing persona engine already supports skipping by complexity; surface-conditional is the same pattern
- Designers want defaults that work, not configuration walls
- Power users (e.g., a project that *is* mixed) want override

## Considered Options

1. **Auto-wire by `project.surface` config field, keep all user-invokable** (proposal)
2. **Always run all personas, materiality gate trims** — relies entirely on existing severity calibration
3. **No conditional wiring — designer manually selects personas per review**

## Decision Outcome

Chosen option: **Option 1**.

Add `project.surface: tui | web | mobile | api | mixed` to `.grimoire/config.yaml`. Detected at onboarding (heuristics) or asked if greenfield. `mixed` runs all personas.

Persona-to-surface matrix lives in `.claude/skills/references/adversarial-personas.md`:

| Persona | TUI | Web | Mobile | API |
|---|---|---|---|---|
| Keyboard navigation | required | required | n/a | n/a |
| Screen reader (ARIA) | n/a | required | required | n/a |
| Color contrast / low-vision | n/a | required | required | n/a |
| Touch target sizing | n/a | n/a | required | n/a |
| Responsive breakpoints | n/a | required | n/a | n/a |
| RTL / i18n | conditional | conditional | conditional | n/a |
| Low bandwidth / offline | n/a | required | required | conditional |
| Hostile actor | required | required | required | required |
| API design (REST/GraphQL conventions) | n/a | n/a | n/a | required |

**User override always available:** `grimoire-review --personas=keyboard,low-vision` or "skip <persona>".

### Consequences

- Good: Defaults match project reality without manual config per review
- Good: Power users (mixed surfaces, multi-platform) opt into `mixed` once
- Good: Materiality gate still applies on top — surface-filtered persona can still drop findings
- Bad: New config field — onboarding flow gets longer (already mitigated by detection heuristics)
- Bad: Detection heuristics will be wrong sometimes (e.g., monorepo w/ TUI and web → must pick `mixed`)
- Bad: Adversarial personas reference doc adds maintenance burden

### Confirmation

If a TUI project review runs keyboard-nav checks but skips responsive-breakpoint checks, and a web project does the reverse, the wiring is correct. If users frequently override with `--personas=...`, defaults are wrong and need tuning.
