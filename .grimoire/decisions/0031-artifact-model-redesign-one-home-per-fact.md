---
status: accepted
date: 2026-06-05
decision-makers: [Fred]
---

# Artifact-model redesign: one home per fact, git as history, live-edit on branch

## Context and Problem Statement

Grimoire's earlier model let the same fact live in several places and reinvented infrastructure that git and the codebase graph already provide. Three concrete symptoms:

1. **Gherkin absorbed slop.** Security controls, NFRs, and observability guarantees were being written as `.feature` scenarios even though they have no external actor and aren't observable without reading code/logs. Feature files filled with pseudo-scenarios that no step definition could honestly verify.
2. **A change had two homes.** Features and decisions were copied into `.grimoire/changes/<id>/features/` and `decisions/`, edited there, then "promoted" back to the baseline on archive. This duplicated every artifact, required a merge-back step, and reimplemented staging — which is exactly what `git diff` already is.
3. **`grimoire map` reinvented structure mapping.** It scanned the tree and froze symbols/key-files into `.snapshot.json` + area-doc tables that drifted the moment code changed — duplicating what codebase-memory-mcp now derives live from the AST.

This violated the project's own principles (DRY — one home per fact; don't reinvent the wheel; KISS).

## Decision Drivers

- One home per fact — no fact should be editable in two places.
- Don't reinvent the wheel — use git for staging/history, the graph for structure.
- Keep each artifact type clean so downstream skills (plan, review, verify) can trust it.
- Reduce the number of steps and moving parts in a change.

## Considered Options

1. **Fixed artifact jurisdiction + live-edit on branch + git/graph as infrastructure** — admission test gates what may become a `.feature`; invariants route to a constraints register; artifacts are edited live on the feature branch with `git diff` as the staging area; `grimoire map` is deleted and structure comes from the graph.
2. **Keep the change-folder/promote model, add a linter** — detect mis-placed facts and duplicated artifacts after the fact rather than removing the structures that cause them.
3. **Status quo** — keep copy-into-change-folder, promote/archive, `grimoire map`, and let Gherkin hold everything.

## Decision Outcome

Chosen option: **fixed artifact jurisdiction + live-edit on branch + git/graph as infrastructure**, because it removes the duplication at the source instead of policing it.

Concrete changes shipped together:

- **Feature admission test.** A `.feature` is allowed only if it has an external actor, is observable without reading code/logs, uses domain language, and survives a reimplementation. The `draft` default flips from "draft a feature" to "find the fact's one home."
- **Constraints register.** Security/NFR/observability invariants live in `.grimoire/docs/constraints.md`, not in `.feature` files. `templates/constraints.md` is installed by `init`.
- **Verify-by-level.** Every planned task carries a `verify:` tag — `scenario` (Gherkin step definition), `unit-invariant` (a constraint), or `characterization` (internal/refactor) — and `apply` writes the test vehicle that matches, instead of forcing a `.feature` onto everything.
- **Live-edit, no promote, no archive.** Features, decisions, constraints, and schema are edited directly on the feature branch. The change folder holds only ephemeral coordination (`manifest.md` + `tasks.md`) and is removed at finalize. There is no copy-into-change-folder, no merge-back, and no `.grimoire/archive/` tree — the PR diff is the change and git history (with the `Change:` trailer) is the record.
- **Delete `grimoire map`.** Structure (symbols, call graphs, reusable code) is read live from codebase-memory-mcp. `map`'s two real capabilities are preserved in `grimoire health`: duplicate detection (already config-driven via `tools.duplicates`) and convention-drift detection (ported in as a metric). `.snapshot.json`, `mapignore`/`mapkeys`/`dupignore`, and the `grimoire log` command (release notes from the archive) are removed with it.
- **Principles gate.** `review` adds a Principles Auditor pass (DRY, one right way, don't reinvent, KISS) plus jurisdiction enforcement. `skills/references/principles.md` is the single home for the four principles.

### Consequences

- Good: each artifact type stays clean — Gherkin is behavior only; invariants have a real home; decisions hold trade-offs.
- Good: a change has exactly one editable copy of each artifact; no promote/merge-back step.
- Good: far fewer moving parts — no snapshot, no archive tree, no `map`/`log` commands to maintain.
- Good: structure never goes stale (graph is live).
- Bad: existing projects on the old model need a one-time migration (drop change-folder copies, move invariants to constraints, delete snapshot/archive).
- Bad: the constraints register is a new artifact contributors must learn.

### Quality Attributes

| Attribute      | Target | Measurement |
|----------------|--------|-------------|
| Data freshness | Always current | Structure read live from the graph; no frozen snapshot |
| Consistency    | One home per fact | No artifact editable in two places; admission test enforced in draft + review |

### Cost of Ownership

- **Maintenance burden**: Lower — deletes the `map`/`log` commands, the snapshot generator, the promote/archive machinery, and their templates. Adds the constraints register (small, human-maintained) and the verify-tag plumbing.
- **Ongoing benefits**: Clean artifacts mean downstream skills make fewer wrong assumptions; git/graph do the staging and structure work for free.
- **Sunset criteria**: Revisit if git or the graph stop being viable as the staging/structure layer, or if the jurisdiction proves too rigid for real changes.

### Confirmation

After implementation: (1) `draft` refuses a constraint-shaped request as a `.feature` and routes it to `constraints.md`; (2) no `.grimoire/archive/` tree or change-folder feature copies are produced by a full change; (3) `grimoire map`/`grimoire log` no longer exist and `grimoire health` reports convention drift; (4) a planned task carries a `verify:` tag and `apply` writes the matching test vehicle.
