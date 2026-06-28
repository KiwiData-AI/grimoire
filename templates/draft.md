---
status: draft
change-id: <kebab-case-verb-led>
kind: greenfield | refactor
# NO complexity here. Complexity is an OUTPUT of design — scored at projection
# (after agreement) and written to manifest.md, never to this file.
---

<!--
  draft.md — the ONE living surface you design a change on.

  This is where the whole change lives as a single coherent picture: diagram/sketch,
  rationale, a decision ledger, pseudo-code, and an open-question ledger. You and the
  user iterate HERE (this is the interview). Nothing is written to features/,
  constraints.md, or decisions/ until the design is agreed — then it is PROJECTED into
  those homes. This file is ephemeral: retained read-only as reference through the
  pipeline, deleted when the change folder is cleared at grimoire-apply finalize. Git
  history preserves it.

  Required sections: At a glance · Why · Decisions · Decided / Open.
  As-needed: Current state (REQUIRED for kind=refactor) · Sketches · Constraints · Cut.
  Delete the guidance comments and any section that carries no weight for this change.
-->

# <change> — draft

**Date:** <YYYY-MM-DD> · **Provenance:** <prior passes / branches / source docs, if any>

## At a glance

<!--
  Make the whole change graspable in one screen. Pick the medium that fits:
    - greenfield → an ASCII flow / box diagram of the system or pipeline
    - refactor   → a pseudo-code sketch of the target shape (annotate with decision IDs)
  If grimoire-design (Figma) output exists for this change, its visual + component/state
  material anchors this section.
-->

## Why

<!--
  greenfield: the objective (what problem, how you'll know it's solved) + non-goals.
  refactor:   the pain points justifying the change — each a NAMED, LOCATED smell with a
              file:line breadcrumb, not an abstract complaint.
-->

## Current state            <!-- REQUIRED for kind=refactor; omit for greenfield -->

<!--
  How the touched system works TODAY, with breadcrumbs to live code. Mandate the codebase
  graph: index_repository first if needed, then search_graph / trace_path / get_code_snippet
  for qualified names, callers, and call chains. Follow with a severity-ranked Gaps/drift
  list — the audit findings that motivate the redesign.
-->

## Decisions

<!--
  ONE inline ledger. Each row: a stable ID, the decision, and its WHY. Use sub-IDs (D1a)
  and cross-references (D7 cites D3) freely — this is how coupled decisions stay legible
  in one place. At projection, each NOVEL decision becomes a MADR (novelty gate applies —
  obvious tooling picks fold into the baseline ADR, they don't mint a record).

  Phrase each row as a Y-statement (see the design-spine reference): the Decision cell states
  "in the context of <spine layer / use-case>, facing <force>, chose <option> over
  <alternatives>, accepting <downside>"; the Why cell is the "because". The context clause
  ties the decision to the layer it serves so it's judged in situation, not in a vacuum.
-->

| #  | Decision (Y-statement: context · option over alternatives · accepting downside) | Why (because…) |
|----|----------|-----|
| D1 |          |     |

## Sketches                 <!-- as-needed; expected for refactor -->

<!--
  Pseudo-code / key considerations for the target shape. Mark it "not final" — it is shape,
  not contract. Annotate lines with the decision IDs they realize (# D8).
-->

## Constraints              <!-- as-needed -->

<!--
  Invariants this change must hold (security / NFR / observability / compliance). One line
  each: assertion · rationale · how-verified. These project to .grimoire/docs/constraints.md
  — NOT to a feature file.
-->

## Decided / Open

<!--
  Two lists. Decided = settled calls (cross-reference the D-IDs). Open = live unknowns.
  Resolve an Open IN PLACE — rewrite it as `RESOLVED: <answer> (Dn)`, do not delete it.
  The struck-through trail is the record of the thinking. Design is "done" when Decided is
  stable and Open is empty-or-deferred.
-->

**Decided:**
-

**Open:**
-

## Cut / deferred           <!-- as-needed; greenfield-leaning -->

<!--
  What was deliberately removed or deferred, so it is not silently lost. Table:
  cut · what it was · why cut · re-add when. Design by subtraction, recorded.
-->

| Cut | What it was | Why cut | Re-add when |
|-----|-------------|---------|-------------|
|     |             |         |             |
