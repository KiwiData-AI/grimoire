---
status: proposed # proposed | accepted | deprecated | superseded by NNNN
date: 2026-06-27
decision-makers: [fred]
---

# Shared named-methodology references for cross-skill guidance

## Context and Problem Statement
Recurring "how to design" guidance had sprawled across `grimoire-design`, `grimoire-draft`,
and `grimoire-plan`: three near-duplicate task orderings, an ad-hoc interview structure with
no consistent sequence, and decisions proposed to the user without the surrounding workflow
context (so ADRs "sounded good" but were wrong for the situation — the Tunnel Vision
anti-pattern). The drift violates DRY and makes the pipeline unpredictable. We want the
design process to be consistent and to perform well, at low change cost.

## Decision Drivers
- DRY / one-home-per-fact — kill the duplicated orderings and scattered interview rules.
- Predictability — design/draft/plan should walk the *same* structure so the user learns where each kind of decision happens.
- LLM adherence at low diff — naming an established methodology the model already knows raises behavior quality more than unnamed prose (the YAGNI-adoption play, ADR precedent in v0.2.1).
- Avoid inducing over-engineering — surfacing structure must be paired with a pruning bias.

## Considered Options
1. **Shared named-methodology reference files** that skills cite (chosen).
2. **Inline guidance per skill** — self-contained but duplicative; the status quo that drifted.
3. **One global block in AGENTS.md** — always in context but not skill-targeted; weak trigger at the moment of use.

## Decision Outcome
Chosen option: **shared named-methodology references**, because it is the only option that is
both DRY (one home) and skill-targeted (fires at the relevant step). Introduces
`design-spine.md` (the ordered path a design walks) and folds in `red-flags.md`
(anti-rationalization), each citing established names so the work inherits a known discipline.

Sub-decisions embedded in `design-spine.md`:
- **Technical spine is inside-out** (process/constraints → data → API → UI; DDD/Clean
  Architecture dependency rule). Honest counter-position — API-first/outside-in — reconciled
  by treating the API as a contract that *hides* the data model, not a mirror of it.
- **Decisions recorded as Y-statements** so context is forced into every entry (defeats Tunnel Vision).
- **Ceremony scales to a constraint count** (>2 constraints ⇒ full layer-by-layer walk), complementing the complexity level.
- **Simplicity bias governs the whole walk** — surface broadly, build narrowly; every surfaced item defaults to non-goal; lean simple when the call is balanced (under-build is cheap to add, over-build is expensive to remove).
- **Reading altitude** (in `artifact-map.md`) — design reads contracts/signatures, not internal source/tests; reading internals is a debugging activity.

**Related decision, same change (separate home):** this change also **relocated projection** from `grimoire-draft` to `grimoire-plan`'s first step (draft designs; plan projects). That is a draft/plan division-of-labor decision, whose home is [0038](0038-living-draft-doc-as-design-surface.md) — recorded there as a dated amendment, not duplicated here.

### Consequences
- Good: skills shrink (net deletions in plan); one predictable structure end-to-end; decisions arrive in context; named methods improve adherence.
- Good: the simplicity bias makes the surfacing machinery safer than the prose it replaces.
- Bad: guidance now lives a hop away (a reference) rather than inline — a skill author must follow the citation.
- Bad: risk that sprawl reappears inside the references; mitigated by one-home-per-concept + cite-don't-restate, checked at review.

### Confirmation
- DRY check: no ordering/interview/decision-format rule restated in two skill files (grep at review).
- Real-use signal: do drafted changes show fewer speculative constraints / more recorded non-goals over time (the over-engineering guard working)?
- Existing test suite stays green (markdown-only change; no runtime impact).
