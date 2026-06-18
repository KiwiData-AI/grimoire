---
status: draft
complexity: 3
branch:
design_ref: .grimoire/changes/add-design-doc-draft-process/draft.md
---

# Change: Living draft.md design process for grimoire-draft

## Why
The spread-out artifacts and their structure hinder the design/drafting process itself —
a change is scattered across features + constraints + N MADR files + a manifest the moment
you start, so review and iteration are hard. Introduce a single living `draft.md` you design
on, and project it into the durable homes only after agreement. Solved when a non-trivial
change is designed on one coherent doc and the specs are generated from it.

## Non-goals
- Not making `draft.md` durable / a source of truth at rest (homes stay authoritative — keeps [0031]).
- Not changing the at-rest one-home-per-fact model or the MADR-per-decision model.
- Not changing `grimoire-review`'s target (still reviews the projected homes, not `draft.md`).
- Not auto-generating the current-state map (it is collaborative, written with the user).

## Feature Changes
- **MODIFIED** `workflow/draft-an-intent.feature` — added two scenarios (single-document design first; trivial change skips the doc)

## Scenarios Added
- `workflow/draft-an-intent.feature`: "A non-trivial change is designed on a single document first"
- `workflow/draft-an-intent.feature`: "A trivial change skips the design document"

## Scenarios Modified
- (none — existing routing scenarios still describe the projection outcomes)

## Decisions
- **ADDED** `0034-living-draft-doc-as-design-surface.md` (proposed) — the core decision; builds on `0031`

## Other artifacts
- **ADDED** `templates/draft.md` — the living design-doc template
- **MODIFIED** `skills/grimoire-draft/SKILL.md` — restructured: triviality gate, one design loop (replaces elicit/draft/collaborate), refactor current-state map, projection step, complexity scored at projection
- **MODIFIED** `skills/grimoire-apply/SKILL.md` — names `draft.md` in the closing change-folder deletion
- **MODIFIED** `skills/references/artifact-map.md` — adds the `draft.md` row

## Prior Art
Direction (build) came from two hand-authored design docs the user prefers over the current
flow, used as the pattern source:
- `heimdall/notes/project-skeleton.md` — greenfield, trim-and-cut: diagram-first, Decided/Open
  ledger, cut list, research appendix, reuse breadcrumbs.
- `kiwi-dev/notes/doc-types-usage-map.md` — refactor: current-state usage map with `file:line`
  breadcrumbs, severity-ranked gaps, numbered decision ledger (D1..DN, sub-IDs, cross-refs),
  pseudo-code sketches, open questions resolved in place.
Common backbone (one living doc, inline decision ledger, breadcrumbs, one-screen graspability,
resolve-in-place open ledger) was adopted; the two flavors fold into one template via `kind`.
Built rather than adopted because no existing grimoire surface provides a single design doc;
the at-rest model from [0031] is reused unchanged.

## Assumptions
- Projecting from `draft.md` produces the same artifact quality the old inline drafting did,
  because the projection step retains the admission test + extend-vs-new triage + novelty gate
  verbatim. *Evidence: the rewritten SKILL.md preserves those reference blocks.*
- The codebase graph (codebase-memory-mcp) is available for refactor current-state maps.
  *Unvalidated on arbitrary projects — `index_repository` is mandated, but an unindexable repo
  would block the refactor map. Flagged.*
- Downstream skills read `complexity` off the manifest, not from `draft.md`, so moving the
  score to projection doesn't break them. *Evidence: plan/review read the manifest today.*

## Pre-Mortem
- **Projection drift.** A fact discussed in `draft.md` never makes it into a home (missed at
  projection). *Mitigation: step 8 Validate re-runs the admission + principles gate over the
  projected homes; the retained `draft.md` is the cross-check.*
- **`draft.md` treated as durable.** Someone edits it after projection expecting it to matter.
  *Mitigation: it is reference-only post-projection and deleted at apply; documented in
  artifact-map + the template header.*
- **Two-ways-to-draft confusion.** The old immediate-fragmentation habit lingers alongside the
  new loop. *Mitigation: the SKILL.md rewrite removes the old path; `draft.md` is the only
  design surface for non-trivial changes.*
- **Refactor map can't be built** (un-indexed repo, no graph). *Accepted for v1 — fall back to
  reading specific source; revisit if it bites.*
