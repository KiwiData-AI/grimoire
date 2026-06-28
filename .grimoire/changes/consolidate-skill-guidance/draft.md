---
status: draft
change-id: consolidate-skill-guidance
kind: refactor
---

# consolidate-skill-guidance — draft

**Date:** 2026-06-27 · **Provenance:** brainstorm comparing obra/superpowers; user direction across the session.

## At a glance

Design guidance was sprawled across draft/plan/design skills. Pull the recurring "how to
design" rules into named-methodology shared references; skills cite, don't restate.

```
references/
  design-spine.md   ← NEW: two spines (UX / technical), walk order, ceremony gate,
                       simplicity bias, Y-statement ledger, plan task order
  red-flags.md      ← (prior task) anti-rationalization
  artifact-map.md   ← + Reading altitude
  elicitation-personas.md ← + named techniques + persona enrichments + prune guard

draft  →  design only (spine walk, Y-statement ledger)         ─┐
plan   →  STEP 1 = projection (moved from draft) → tasks         │ cite design-spine
design →  UX traversal direction                                 │
review →  ladder findings; check decisions-in-context           ─┘
```

## Why

Sprawl: three near-duplicate task orderings, ad-hoc interview structure, decisions proposed
without context (Tunnel Vision). Consolidate + name the methodology (the YAGNI play — named
terms the model knows raise adherence at low diff). Done when one home per concept, no rule
restated twice. **Lean simple**: surfacing machinery must ship with a pruning bias or it
manufactures the over-engineering it's meant to prevent.

## Current state → target

- Orderings restated in plan ×3 → one technical-spine order in `design-spine.md`, cited.
- Interview was a free-form loop → walks a named spine (UX backward/forward · technical inside-out), in order, each layer validating the prior.
- Decisions were freeform ledger rows → Y-statements (context forced in).
- Projection was draft's step 7–8 → plan's step 1 (draft designs; plan projects).
- No altitude rule → "design reads contracts, debugging reads internals" (the AxisAI token-burn).

## Decisions

| #  | Decision (Y-statement) | Why (because…) |
|----|------------------------|----------------|
| D1 | In the context of cross-skill guidance, facing sprawl/drift, chose shared named-methodology references over inline-per-skill or an AGENTS.md block, accepting one indirection hop | DRY + skill-targeted; names boost LLM adherence (ADR-0037) |
| D2 | In the context of the technical spine, facing the API-first counter-position, chose inside-out (data→API) accepting it's not outside-in | reconciled by API-as-contract-that-hides-the-model |
| D3 | In the context of ceremony cost, facing "don't drown level-2", chose a >2-constraint escalation trigger over level-only | constraint count is complexity surfacing, measurable mid-interview |
| D4 | In the context of the surfacing machinery, facing YAGNI risk, chose a governing simplicity bias (default non-goal; lean simple) | under-build is cheap to add, over-build hard to remove |
| D5 | In the context of the draft→plan seam, facing an awkward two-phase draft, chose to move projection to plan's step 1 | one job per skill; co-locate projection with its consumer |

## Decided / Open

- **Decided:** one spine reference (two labeled variants), not two — shared walk/validate mechanic. (D1)
- **Decided:** Theme A (reading altitude) ships this round, in `artifact-map.md`. (user)
- **Decided:** review uses laddering to ground findings. (user)
- **Open → deferred:** forced-invocation hook (superpowers' moat) — separate change.

## Cut (out of scope)

- New skills; runtime/CLI changes; the invocation hook; measuring the adherence claim.
