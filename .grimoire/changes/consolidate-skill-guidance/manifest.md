---
status: draft
complexity: 3
branch: consolidate-skill-guidance
design_ref:
---

# Change: Consolidate skill guidance into named-methodology shared references

## Why
Design/draft/plan guidance had sprawled and drifted across skill files (three near-duplicate
task orderings, ad-hoc interview structure, decisions proposed without surrounding context).
Consolidate the recurring guidance into shared references that name the established
methodology behind it — leaning on terms the model already knows (Working Backwards,
inside-out/DDD layering, stepwise refinement, Y-statement, Tunnel Vision) raises behavior
quality at low diff, the same play as YAGNI. Done when the skills cite one home per concept
and no ordering/format rule is restated in two places.

Also relocates **projection** (turning the agreed `draft.md` into features/constraints/
MADRs/`data.yml`/manifest) out of `grimoire-draft`'s last step and into `grimoire-plan`'s
first step — draft's one job becomes *design the change*, plan's becomes *project it, then
break it down*. A two-phase draft felt wrong once the spine made draft about the design loop.

## Non-goals
- No runtime/CLI behavior change. Skills are pure markdown (ADR-0010); this is guidance only.
- No new skill. Pure consolidation + two new *references*, not new workflow surface.
- Not forcing ceremony on small changes — the simplicity bias and constraint-count gate keep
  level-1–2 changes lightweight.
- Not building a forced-invocation hook (separate concern, deferred).

## Feature Changes
None — skills are markdown, not actor-observable behavior. No `.feature` files.

## Decisions
- **ADR-0037** — Shared named-methodology references for cross-skill guidance.
- **ADR-0038** (amended) — projection relocated from draft to plan; this ADR (renamed from a duplicate `0034`) owns the draft/plan division of labor.

## Artifacts
**Added**
- `skills/references/design-spine.md` — the spine (UX + technical), walk discipline, ceremony
  gate, simplicity bias, Y-statement ledger, plan task order.
- `skills/references/red-flags.md` — anti-rationalization excuses (prior task, folded in here).

**Modified**
- `skills/references/artifact-map.md` — Reading-altitude section; draft.md projected-at-plan.
- `skills/references/elicitation-personas.md` — named techniques (laddering/Mom Test/CIT/5-Whys),
  review-laddering, Data/Senior/QA persona enrichments, surface-then-prune guard.
- `skills/grimoire-draft/SKILL.md` — walk-the-spine + Y-statement ledger + altitude pointer; **projection removed** (now a handoff to plan) (+ prior red-flags pointer).
- `skills/grimoire-plan/SKILL.md` — **new step 1: Project the Design** (relocated from draft); task order = technical-spine; altitude pointer (+ prior red-flags pointer).
- `skills/grimoire-design/SKILL.md` — UX traversal direction at user-flow; altitude pointer; handoff wording (projection at plan).
- `skills/grimoire-review/SKILL.md` — ground findings via laddering/spine (+ prior red-flags pointer).
- `skills/grimoire-apply/SKILL.md`, `skills/grimoire-verify/SKILL.md` — prior red-flags pointers.
- `templates/draft.md` — Decisions ledger phrased as Y-statement.
- `AGENTS.md`, `README.md` — decision tree, workflow narrative, and walkthrough updated for draft-designs / plan-projects.

## Assumptions
- Naming established methodologies improves LLM adherence vs. unnamed prose. (Evidence:
  consistent with the YAGNI adoption in v0.2.1; not independently measured here.)
- The simplicity bias + constraint-count gate are sufficient to stop the surfacing machinery
  from inducing over-engineering. (Unvalidated — the central risk; see Pre-Mortem.)

## Pre-Mortem
- **The spine induces over-engineering** — personas surface more cases → more built handling.
  *Mitigation:* simplicity bias is a governing top-of-file rule; every surfaced item defaults
  to non-goal; constraints counted as cost. Watch real usage.
- **Sprawl just moves into the references** — reference files bloat instead of skills.
  *Mitigation:* one home per concept; skills cite, never restate; DRY checked at review.
- **Ceremony gate misfires** — trivial changes trip >2 constraints. *Mitigation:* gate is a
  depth signal, not a block; empty layers skip in one line. Accepted, revisit if noisy.
