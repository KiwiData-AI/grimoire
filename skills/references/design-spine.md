# Design Spine

The ordered path a design walks — in the interview (`grimoire-draft`, `grimoire-design`), in
evaluation (`grimoire-review`), and in task order (`grimoire-plan`). One spine, walked the
same way everywhere, so the structure is predictable: the user learns where each kind of
decision happens.

This is the single home for *how* a design proceeds. Skills cite the relevant section; none
restate it (DRY). It pairs with `principles.md` (what every artifact must satisfy) and
`red-flags.md` (the excuses to skip a stage) — this file is the *sequence* the work follows.

The methods below are named on purpose. They are established practice — lean on the name
(Working Backwards, inside-out layering, stepwise refinement, Y-statement) so the work
inherits a known, well-understood discipline instead of an ad-hoc one.

---

## Bias: complete, not over-built

The spine and its personas are a **surfacing** tool — they raise candidates (steps,
constraints, "what happens if" cases). Surfacing tools bias toward *more*: every question
invites a handler, every constraint feels like rigor. Left ungoverned, walking the spine
*manufactures* the over-engineering YAGNI warns against. So the walk has one governing rule:

**Surface broadly, build narrowly.** The spine raises the candidate; `principles.md` §4
(KISS/YAGNI) decides whether it earns a place. They are a pair — never run the surfacing
without the prune.

- **Every surfaced item gets a disposition, and the default is *don't build it*.** Each
  candidate resolves to one of: *build* (a present, concrete need requires it), *won't build*
  (record as a one-line non-goal), or *defer*. When unsure, it's a non-goal. Recording "we
  considered X and chose not to" is completeness; building X "just in case" is not.
- **Lean simple when you must lean.** Under-building is cheap to add later; over-building is
  expensive to remove. If the call is genuinely balanced, choose the simpler, less-complete
  option and say so — complexity layers in cleanly later, but rarely comes back out.
- **"Complete" means the stated outcome plus the failures whose cost the user would actually
  feel — not every conceivable case.** Completeness is measured against the outcome, not
  against an exhaustive enumeration of edge cases.
- **Constraints are surface area, not virtue.** Each must earn its place with a present,
  concrete *why* (a downstream need, a real corruption risk). A constraint justified only by
  "might need to" is YAGNI — cut it. This is why the ceremony gate counts constraints as a
  *cost* signal, not a rigor score.

---

## Pick the spine

Two spines. Pick by what the change touches; **once picked, always walk it in order** (next
section). A mixed change uses the technical spine and expands its UI layer with the UX spine.

| Change | Spine | Home skill |
|--------|-------|-----------|
| User-facing flow / screen / UI | **UX-workflow spine** | `grimoire-design` |
| Behavioral / technical (API, data, logic) | **technical spine** | `grimoire-draft` |
| Mixed (UI + backend) | **technical**, UI layer via UX | draft + design for the UI layer |

### UX-workflow spine — traversal direction
Walk the user's process in one of two directions. State which you're using.

- **Backward — "Working Backwards"** (Cooper goal-directed design; Amazon PR/FAQ). Start at
  the **goal / end-state** (a JTBD outcome: "when *situation*, I want *motivation*, so I can
  *outcome*"). At each step ask **"what must be true for the user to reach here?"** Best when
  the goal is clear but the path is contested — it surfaces unknown prerequisites and prunes
  steps that serve no downstream need.
- **Forward — "forward chaining"** (skills-forward). Start from **what the user reasonably
  knows or has at the start** and step toward the goal. Best when the starting state is well
  defined but the goal is emergent, or when documenting an existing happy path.

**Reconcile (the discipline):** define the end-state, chain **backward** to the required
prerequisites, then **validate forward** by walking a real user from their actual starting
knowledge (the Mom Test — see `elicitation-personas.md`). Where the two traversals don't meet
are the missing or assumed steps — capture each as an Open row.

### Technical spine — layer order
Design **process/constraints → data model → API/contract → UI, component by component.** This
is **inside-out** layering (DDD layered architecture / Clean Architecture dependency rule):
the domain and its rules sit at the core; the API and UI are outer detail that depend inward,
never the reverse.

| Layer | What you settle here |
|-------|----------------------|
| **1 · Process / constraints** | The invariants and limits that must always hold — business rules, security controls, NFRs, what must *never* happen (data-corruption guards). These bound everything downstream. |
| **2 · Data model** | Entities, fields, relationships, and each field's constraints (required / unique / nullable / range). Every constraint states its *why* — the downstream need or corruption risk that justifies it (→ a `constraints.md` row). |
| **3 · API / contract** | The interface other code or clients use. Design it as a deliberate contract that **hides** the data model — this reconciles "data-first" with "API-first": the API is a versioned abstraction over the schema, not a mirror of it. |
| **4 · UI, by component** | The surface, one component at a time. For a user-facing surface, expand this layer with the UX-workflow spine above. |

**Each layer constrains the next** (*stepwise refinement* — every decision narrows the
solution space for the layers below). **Building a layer validates the prior** (*consumer-
driven contracts* / model–implementation feedback): designing the API tests the data model;
designing the UI tests the API. When a lower layer can't satisfy an upper one, the upper one
was wrong — go back and fix it, don't patch around it downstream.

## Walk it — always, in order

Whatever spine is chosen, **traverse its layers/steps in order; do not jump around.** At each
layer:

1. **Elicit** with that layer's lens — personas are the *who* (`elicitation-personas.md`),
   techniques are the *how* (laddering / Mom Test / 5 Whys, same file).
2. **Record decisions** for the layer in the `draft.md` ledger as Y-statements (below).
3. **Validate the prior** layer against what you just learned — restate the check explicitly
   ("this required field traces to *downstream need X*"; "this data model satisfies process
   constraint *C*"). A failed validation sends you back up, not forward.

An **empty layer is fine** — say so in one line and skip (a change with no data impact skips
layer 2). Skipping is a stated call, never a silent omission.

## Ceremony gate — scale to the constraints, not first impressions

Full layer-by-layer ceremony is for changes that earn it; trivial ones don't.

- **Default (lightweight):** walk the spine, but elicit only what the change needs and skip
  empty layers in one line. Most level-1–2 changes finish here.
- **Escalate to full ceremony when the change introduces more than 2 constraints** (data
  invariants, security controls, cross-layer dependencies). The **3rd** new constraint is the
  signal that real complexity is hiding — from there, walk every layer formally, record a
  decision per layer, and (level 3–4) add the manifest Pre-Mortem.

Constraint count is a measurable trigger that complements the complexity level: complexity is
an *output* of design, and the count is that output surfacing mid-interview. A nominally
"simple" change that trips the gate is not simple — let the count, not the first impression,
set the depth.

## Decisions — Y-statement, in context

Every decision in the `draft.md` ledger is recorded as a **Y-statement**, so its context is
forced into the record. This defeats the *Tunnel Vision* anti-pattern — a decision that reads
well in isolation but is wrong for the surrounding workflow:

> **D*n*:** In the context of *spine layer / use-case*, facing *concern / force*, we chose
> *option* over *alternatives*, to achieve *quality*, accepting *downside* — **because
> *why*.**

The **because** is mandatory. The **context** clause ties the decision to the spine layer it
emerged from, so the user evaluates it *in the situation it serves*, not as an abstract claim
("sounds good" decided in a vacuum is exactly how ADRs go wrong). Coupled decisions
cross-reference by ID (D7 cites D3). At projection (`grimoire-plan`'s first step) each ledger entry
maps cleanly to a MADR: the context clause becomes the ADR's *Context and Problem Statement*,
the chosen/neglected options its *Considered Options / Decision Outcome*, the accepted
downside its *Consequences*. The novelty gate still applies — industry-default picks fold into
the baseline ADR, not a new record.

## Plan task order follows the technical spine

`grimoire-plan` emits tasks in the **same layer order** the change was designed on, so the
plan's shape mirrors the design:

```
dependencies → data/schema → API/contract → business logic → UI by component → verification
```

Within each layer, **test first** — the failing test for that layer-pair before its code.
This is the per-layer red-green unit, not a single global acceptance test up front. The order
is fixed on purpose: over time the user learns that schema changes always land before API
changes, contract tests before clients, UI last.

---

## How skills cite this

- **design** — UX-workflow spine (traversal direction) at the user-flow step.
- **draft** — pick + walk the spine in the design loop; Y-statement ledger; ceremony gate.
- **plan** — task order = technical-spine order; test-first per layer.
- **review / verify** — check that decisions name their context and each layer validates the prior.

Each skill links its own section; none restate the spine. This is the one home (DRY).
