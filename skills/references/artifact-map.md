# Artifact Map & Reading Discipline

Loaded by skills that read a change's specs before acting (`grimoire-plan`, `grimoire-draft`, `grimoire-design`, `grimoire-review`, `grimoire-pr-review`). This is the single home for **what each grimoire artifact is** and **how to read them**. Skills link here instead of restating it; they keep only the reading focus specific to their job.

---

## The artifacts

Per-change (under `.grimoire/changes/<change-id>/`):

- **`draft.md`** — the living design doc the change was designed on (diagram/sketch, decision ledger, pseudo-code, Decided/Open ledger). The single source the other artifacts were **projected** from at the end of `grimoire-draft`. Ephemeral: retained read-only as the agreed-design reference through the pipeline, deleted when `grimoire-apply` clears the change folder. Read it for the *intent and rationale* behind the projected artifacts; the features/constraints/decisions remain the authoritative homes.
- **`manifest.md`** — change summary, complexity level, and the Why. Level 3-4 also carry Assumptions, Pre-Mortem, and **Prior Art** (the build-vs-buy rationale). Generated from `draft.md` at projection.
- **`features/*.feature`** — behavioral specifications. Edited live in `features/` on the branch.
- **decision records** — architectural choices for this change, edited live in `.grimoire/decisions/`, including Cost of Ownership sections.
- **`tasks.md`** — the implementation plan (present once planned).
- **`data.yml`** — proposed schema changes (present only when the change touches the data model).

Project-wide (under `.grimoire/`):

- **`config.yaml`** — language, tools, conventions, `comment_style`, `commit_style`, `compliance`, `dep_audit`.
- **`docs/<area>.md`** — per-area Purpose, Boundaries, Conventions, and "Where New Code Goes". Intent and placement, not live structure.
- **`docs/data/schema.yml`** — the full data model: tables/collections, field types, relationships, indexes, external API contracts with `source:` pointers. Read this instead of individual model files.
- **`docs/context.yml`** — deployment environment, related services, infrastructure dependencies, CI/CD, observability. Tells you runtime constraints (Lambda → no long-running processes), cross-service boundaries (auth lives in a sibling service), and what's available (Redis, RabbitMQ).
- **`brand/tokens.json`**, **`brand/voice.md`** — design grounding (see `brand-tokens-format.md`).

---

## Reading discipline

**Grimoire docs first, codebase second.** `.grimoire/docs/` is a pre-computed map — where code lives, what utilities exist, what patterns to follow, what the data layer looks like. Read it *instead of* exploring raw source. Read specific source files only when the docs don't have what you need.

**Graph for live structure.** Area docs give intent and placement; they do not carry exact symbols. For function names, file paths, line numbers, reusable utilities, and call graphs, query the graph — `search_graph` / `get_code_snippet` / `get_architecture`. Combine the two: area doc says *where new code goes*, the graph says *what's already there to reuse*.

**Do NOT read the entire codebase for "context."** Area docs + data schema + the graph already give you specific paths and assertions. Reading dozens of source files wastes context and does not produce better output. Read specific source only to verify a detail the docs can't answer (exact signature, exact import path, existing step-definition setup).

---

## Staleness gate

For each area doc you load, compare its `last_updated` against `git log -1 --format=%ci <directory>`. If the doc is older than the most recent commit to its directory, it's stale — its paths, utility names, and patterns may be wrong.

- **Level 1-2:** warn (`Area doc for <area> is behind recent commits — rely on the graph for structure`) and proceed. Mark inferred paths with `<!-- inferred: area doc may be stale -->`.
- **Level 3-4:** blocker. Do not proceed until the user refreshes via `grimoire-discover` targeted refresh. Acting on stale docs at this complexity produces wrong paths and misses recent utilities — re-doing the work costs more than refreshing first.

If area docs don't exist at all, tell the user to run `/grimoire:discover` first.
