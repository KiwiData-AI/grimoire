# Artifact Map & Reading Discipline

Loaded by skills that read a change's specs before acting (`grimoire-plan`, `grimoire-draft`, `grimoire-design`, `grimoire-review`, `grimoire-pr-review`). This is the single home for **what each grimoire artifact is** and **how to read them**. Skills link here instead of restating it; they keep only the reading focus specific to their job.

---

## The artifacts

Per-change coordination (under `.grimoire/changes/<change-id>/`):

- **`draft.md`** — the living design doc the change was designed on (diagram/sketch, decision ledger of Y-statements, pseudo-code, Decided/Open ledger). The single source the other artifacts are **projected** from at the start of `grimoire-plan`. Ephemeral: retained read-only as the agreed-design reference through the pipeline, deleted when `grimoire-apply` clears the change folder. Read it for the *intent and rationale* behind the projected artifacts; the features/constraints/decisions remain the authoritative homes.
- **`manifest.md`** — change summary, complexity level, and the Why. Level 3-4 also carry Assumptions, Pre-Mortem, and **Prior Art** (the build-vs-buy rationale). Generated from `draft.md` at projection.
- **`tasks.md`** — the implementation plan (present once planned).

Durable live artifacts:

- **`config.yaml`** — language, tools, conventions, `comment_style`, `commit_style`, `compliance`, `dep_audit`.
- **`features/**/*.feature`** — behavioral specifications edited live on the branch.
- **`.grimoire/decisions/*.md`** — architectural choices edited live on the branch.
- **`.grimoire/docs/constraints.md`** — proven security, NFR, observability, and compliance invariants.
- **`docs/<area>.md`** — per-area Purpose, Boundaries, Conventions, and "Where New Code Goes". Intent and placement, not live structure.
- **`docs/data/schema.yml`** — the full data model: tables/collections, field types, relationships, indexes, external API contracts with `source:` pointers. Read this instead of individual model files.
- **`docs/context.yml`** — deployment environment, related services, infrastructure dependencies, CI/CD, observability. Tells you runtime constraints (Lambda → no long-running processes), cross-service boundaries (auth lives in a sibling service), and what's available (Redis, RabbitMQ).
- **`brand/tokens.json`**, **`brand/voice.md`** — design grounding (see `brand-tokens-format.md`).

---

## Reading discipline

**Intent docs first, graph for structure, source for exact details.** `.grimoire/docs/` records purpose, boundaries, placement, and the data model. Read specific source files only when the docs and graph cannot answer an exact signature or implementation detail.

**Graph for live structure.** Area docs give intent and placement; they do not carry exact symbols. For function names, file paths, line numbers, reusable utilities, and call graphs, query the graph — `search_graph` / `get_code_snippet` / `get_architecture`. Combine the two: area doc says *where new code goes*, the graph says *what's already there to reuse*.

**Do NOT read the entire codebase for "context."** Area docs + data schema + the graph already give you specific paths and assertions. Reading dozens of source files wastes context and does not produce better output. Read specific source only to verify a detail the docs can't answer (exact signature, exact import path, existing step-definition setup).

---

## Reading altitude — design reads contracts, debugging reads internals

When you read code during **design** (`grimoire-draft`, `grimoire-design`, `grimoire-plan`), read at the **published-interface altitude** — what a caller needs to integrate, not how the callee works inside:

- **Third-party library or service** — its public API, types, and docs. Not its source, and not its tests. The contract is what you design against; the internals are the maintainer's concern.
- **Your own system** — the touched area's exported symbols, API endpoints, and data schema, plus the relevant feature files and `constraints.md`. Not the whole backend's source, and not its unit tests.
- **Prefer the graph for structure without bodies.** `search_graph` / `get_architecture` give signatures, callers, and call edges — the *shape* of the interface — without spending context on implementation bodies. That is the altitude design needs.

**Reading full source bodies and unit tests is a *debugging* activity** — justified when a behavior is wrong and you need root cause (`grimoire-bug`), not when you need to know how an interface is used. In design the question is "what is the contract?", and the contract lives in signatures, schemas, and specs — not in line-by-line implementation. Exhaustively reading internals at design time burns context and rarely improves the design. This is the rule above, sharpened: even when you *do* read source, read the seam, not the guts.

Area docs change when purpose, boundaries, placement, or conventions change. Source commits alone do not make intent documentation stale.
