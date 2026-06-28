---
status: proposed
date: 2026-06-17
decision-makers: [Fred]
---

# Living `draft.md` as the single design surface, projected into homes after agreement

> **Amended 2026-06-28** (change `consolidate-skill-guidance`, see [0037](0037-named-methodology-shared-references.md)): **projection moved from the end of `grimoire-draft` to the first step of `grimoire-plan`.** Draft now designs only; plan projects, then plans. The "Projection happens in `grimoire-draft`" framing below is superseded by this amendment — the locus is plan, the timing (after the design is agreed) is unchanged. Everything else here (the living `draft.md` surface, one-home-per-fact at rest, complexity-as-output) stands. Also renumbered from a duplicate `0034`.

## Context and Problem Statement

`grimoire-draft` (post-[0031](0031-artifact-model-redesign-one-home-per-fact.md)) routes
each fact to exactly one home — feature, constraint, or MADR — and writes it there
immediately. One-home-per-fact is right for the artifacts **at rest**, but enforcing it
*during* design fragments the thinking: the moment you start, a change is scattered across
`features/`, `.grimoire/docs/constraints.md`, N separate `.grimoire/decisions/*.md`, and a
manifest. There is no single surface where the whole change — its diagram, rationale,
coupled decisions, pseudo-code, and open questions — is legible at once.

Concrete symptoms:

1. **Review and iteration were too hard.** With the design spread across many files, the
   author resorted to hand-writing one big prompt containing everything the drafting
   process needed — manually reconstructing the coherent surface the tool failed to give.
2. **Decisions were minted into separate files from the start.** Tightly-coupled decisions
   (one cites another) are far harder to reason about across N files than in one ledger.
   Both hand-authored design docs the author prefers keep an inline `D1..DN` ledger.
3. **Refactors were designed blind.** The "check existing state" step only read artifacts to
   avoid conflicts; it never produced a map of how the touched system works *today*, with
   breadcrumbs — the load-bearing first half of a good refactor design.
4. **Complexity was scored up front**, before the design that reveals it existed — biasing
   the design to fit a premature number.
5. **Interview, draft, and collaborate were three separate steps** with lossy handoffs,
   rather than one act of designing on a shared doc.

## Decision Drivers

- One coherent surface to design on — graspable, reviewable, easy to collaborate on.
- Preserve one-home-per-fact **at rest** (don't undo [0031]).
- Keep coupled decisions legible (one ledger, cross-references) during the thinking.
- Don't reinvent git — ephemerality with git as the history backstop.
- Refactors need a current-state map; greenfield needs a diagram and a cut list.
- Complexity is an output of design, not an input.

## Considered Options

1. **Ephemeral `draft.md` as the sole design surface; project into homes after agreement.**
   Design the whole change in one doc; generate features/constraints/MADRs/manifest from it
   at the end of `grimoire-draft`; retain `draft.md` read-only as reference; delete it at
   `grimoire-apply`. (Chosen.)
2. **Durable `draft.md`; homes become projections of it.** Make the design doc the source of
   truth at rest and treat features/constraints/MADRs as generated views. Rejected — collides
   head-on with [0031]'s one-home-per-fact at rest and is a far larger blast radius.
3. **Status quo** — keep immediate fragmentation across homes during drafting. Rejected — it
   is the problem.

## Decision Outcome

Chosen option: **ephemeral `draft.md` as the single design surface, projected into the
durable homes after agreement.** It gives one coherent place to think while leaving the
at-rest model from [0031] untouched.

Concrete changes shipped together:

- **`draft.md` is the only surface you design on.** `templates/draft.md` provides the
  skeleton: *At a glance* (diagram or pseudo-code sketch), *Why*, *Current state*
  (refactor-only), *Decisions* (one inline ledger), *Sketches*, *Constraints*, *Decided /
  Open*, *Cut / deferred*. Required: At a glance, Why, Decisions, Decided/Open.
- **Interview = iterating on `draft.md`.** The old elicit / draft / collaborate steps
  collapse into one loop: propose into the ledger → question into *Open* → user reacts →
  resolve in place (`RESOLVED:`). Requirements surface, get questioned, and resolve inside
  the doc.
- **Projection happens at the start of `grimoire-plan`, after the design is agreed** (amended;
  originally `grimoire-draft`). The fine fact-to-home routing (admission test + jurisdiction)
  and the principles gate run there, generating features/constraints/MADRs/`data.yml`/manifest
  live in their real locations. The coarse routing (is this a grimoire change at all?) stays up
  front in draft.
- **Complexity is an output.** Up front there is only a binary triviality gate (typo/config
  → skip `draft.md`). The 1–4 level is scored at projection and written to the manifest.
- **Refactors mandate a current-state map.** For `kind: refactor`, the design starts by
  mapping how the touched system works today with `file:line` breadcrumbs, using the
  codebase graph (`index_repository` first if needed), plus a severity-ranked gaps list.
- **Ephemeral, git-backed.** `draft.md` is retained read-only through plan → … → apply as
  the agreed reference, then deleted when `grimoire-apply` clears the change folder. Git
  history preserves it — "deleted" ≠ lost.
- **Decisions still project to separate MADRs.** The inline ledger is a thinking convenience;
  at projection each novel decision becomes a sequential MADR (novelty gate unchanged),
  obvious picks fold into the baseline ADR. The at-rest decision model from [0031] is intact.

## Consequences

- Good: one coherent, reviewable surface — the diagram, rationale, decision ledger, sketches,
  and open questions are legible together; collaboration and iteration are far easier.
- Good: coupled decisions stay in one cross-referenced ledger during design.
- Good: refactors are grounded in a real current-state map, not designed blind.
- Good: complexity is scored honestly, after the design exists.
- Good: one-home-per-fact at rest is untouched; `draft.md` is the (soon-deleted) source the
  homes were projected from, not a parallel authority.
- Bad: a transient window where `draft.md` and the projected homes both exist (between
  projection and apply). Mitigated: `draft.md` is read-only reference, not a second editable
  source; the principles gate explicitly exempts it.
- Bad: contributors learn a new artifact (`draft.md`) and the projection step.
- Bad: `grimoire-plan` carries more responsibility (it opens with projection); `grimoire-apply`
  gains one closing deletion. (Amended: projection was originally draft's — relocated to plan so
  draft's single job is design.)

### Quality Attributes

| Attribute   | Target | Measurement |
|-------------|--------|-------------|
| Consistency | One home per fact at rest | Homes are the only authority after projection; `draft.md` is reference-only and deleted at apply |
| Reviewability | Whole change graspable in one doc | A single `draft.md` carries diagram + ledger + sketches + open items |

### Cost of Ownership

- **Maintenance burden**: Adds `templates/draft.md` and a projection step in `grimoire-draft`;
  one extra deletion in `grimoire-apply`. Removes the immediate-fragmentation drafting path.
- **Ongoing benefits**: Easier design review/iteration; refactors grounded in current-state
  maps; honest complexity scoring; coupled decisions legible during design.
- **Sunset criteria**: Revisit if the ephemeral-then-project flow proves to cost more than the
  fragmentation it removes, or if a durable design doc (option 2) becomes worth the larger change.

### Confirmation

After implementation: (1) a non-trivial change produces a `.grimoire/changes/<id>/draft.md`
and nothing is written to `features/`/`constraints.md`/`decisions/` until projection;
(2) a `kind: refactor` design contains a Current state section with `file:line` breadcrumbs;
(3) `complexity` is absent from `draft.md` and present in the manifest after projection;
(4) `grimoire-apply` removes `draft.md` with the change folder and git history still contains it.
