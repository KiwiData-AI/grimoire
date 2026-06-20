---
name: grimoire-draft
description: Design a change collaboratively on one living draft.md, then project it into Gherkin features, constraints, and MADR decisions. Use when the user describes new functionality, requirements, or architecture choices.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.2"
---

# grimoire-draft

Design a change on **one living document** (`draft.md`), iterating with the user, then
**project** the agreed design into its durable homes (features, constraints, decisions).

The core idea: spread-out artifacts hinder the thinking. So you do all the designing in a
single coherent doc — diagram/sketch, a decision ledger, pseudo-code, an open-question
ledger — and only fragment it into separate homes **after agreement**. `draft.md` is
ephemeral: retained as reference through the pipeline, deleted when `grimoire-apply` clears
the change folder. Git history preserves it.

## Triggers
- User describes new functionality, behavior changes, or feature requests
- User asks to create/update a feature spec or requirement
- User describes a technology choice, architecture decision, or trade-off
- Loose match: contains "feature", "requirement", "spec", "decision", "grimoire" with "create", "draft", "plan", "start", "new"

## Routing (coarse — up front)

Decide only whether to design at all, and in which skill. The **fine** routing (which fact
becomes a feature vs. a constraint vs. a decision) happens later, at projection (step 7).

- Bug report ("something is broken") → `grimoire-bug` or `grimoire-bug-report`
- Pure refactoring (no behavior change) → no grimoire artifact needed. Suggest an ADR only if architecturally significant.
- Config, deps, formatting → not grimoire territory. Just do it.
- Otherwise → design it here. If genuinely unclear whether this is a grimoire change, ask one clarifying question rather than guessing.

## Workflow

### 1. Qualify the Request — Jurisdiction (coarse)

Confirm this is a change worth designing, and which skill owns it (table above). You do
**not** need to assign each fact to a home yet — during design everything lives in one
`draft.md`; per-fact routing is a projection concern (step 7, D13).

The one up-front question that matters: **is this a behavior/feature/architecture change**
(→ design it here), or a bug / pure refactor / config tweak (→ route away, per the table)?
If unclear, ask one question. Do not default to "draft a feature".

### 2. Triviality Gate

Complexity is an **output** of design, not an input — you cannot score it honestly before
the design exists. Up front, make only one binary call:

- **Trivial** — config, typo, copy change, single-file fix, dependency bump. Skip the
  `draft.md` loop: make the change directly, record a minimal `manifest.md` (Why + file
  list), done.
- **Non-trivial** — anything else. Build a `draft.md` and design the change (steps 3–8).

The full **complexity level (1–4)** is scored at **projection** (step 7), once the design
is settled, and written to `manifest.md` — not before (a premature number biases the design
to fit it). During design, use the table below only as a rough guide for how deep to
research and elicit; depth grows with the change, it is not pre-allocated.

| Level | Label | Signals | Drives (recorded at projection) |
|-------|-------|---------|---------------------------------|
| 1 | Trivial | Config, typo, copy, single-file fix | handled by the gate above — no `draft.md` |
| 2 | Simple | Single capability, ≤3 files, no architecture/data changes | Plan: coarser tasks · Review: Senior Engineer only |
| 3 | Moderate | Multiple capabilities, architecture decisions, data/dep changes | Plan: fine-grained · Review: all relevant personas · manifest carries Assumptions + Pre-Mortem |
| 4 | Complex | Cross-cutting, multiple services, security-sensitive, new infra | Plan: fine-grained · Review: all personas mandatory (`grimoire-review` not optional) · Assumptions + Pre-Mortem |

If unsure between two levels at projection, pick the higher. The user can override ("treat this as complex").

### 3. Research Existing Solutions

Before designing, research what already exists. Do not ask the user to research — do it yourself.

- Trivial changes never reach this step (handled by the gate).
- Otherwise research **proportional to scope**: a single first-party capability needs only a
  built-ins / first-party check; architecture decisions, new dependencies, or cross-cutting
  concerns need full research across all categories.

Follow the methodology in `../references/build-vs-buy.md`. The findings feed the `draft.md`
**Why** (and, for an adopt/build/hybrid call, the manifest **Prior Art** at projection).
Present findings to the user and get agreement on direction before designing deeply.

### 4. Design Input Check

Check whether design artifacts already exist for this change, so the design is grounded in
real components and states rather than imagined ones. Consumed output anchors the `draft.md`
**At a glance** section.

- **Existing design output**: If `.grimoire/changes/<change-id>/designs/` is already populated (a prior `grimoire-design` run produced `problem.md`, `variants.md`, `variant-{n}.html`, or `figma-snapshot.json`), read those now. Treat them as authoritative for component shape, states, and visual tokens — do not re-query Figma. The visual + component/state material becomes the **At a glance** anchor and seeds the behavioral **Sketches**.
- **Figma MCP available, no design folder**: If `project.design_tool.mcp` is configured and `designs/` is absent, ask: "Figma file URL or node ID? (or skip)". On a URL or node reference, query the Figma MCP for frame data and cache the response at `.grimoire/changes/<change-id>/designs/figma-snapshot.json` per `../references/design-input-formats.md` §1 Cache. On "skip" or empty input, continue.
- **No MCP and no design folder**: skip this step silently.

### 5. Scaffold & Map Existing State

- Choose a `change-id`: kebab-case, verb-led (`add-`, `update-`, `remove-`).
- Ensure you're on a feature branch for this change (`grimoire-branch-guard` usually created it). The branch is where `draft.md` and, later, the projected artifacts are edited live.
- Create `.grimoire/changes/<change-id>/draft.md` from `templates/draft.md`, setting `kind: greenfield | refactor`.

Then map what already exists so the design isn't blind:

- Read `features/` for the current behavioral baseline, `.grimoire/decisions/` for existing decisions, `.grimoire/docs/context.yml` for the deployment environment and sibling services. Check `.grimoire/changes/` for in-progress changes that overlap — flag conflicts. See `../references/artifact-map.md` for reading discipline.
- **For `kind: refactor` — build the Current state section (required).** Map how the touched system works **today**, with `file:line` breadcrumbs, into `draft.md` → *Current state*, followed by a severity-ranked Gaps/drift list. **Mandate the codebase graph**: if the repo isn't indexed, run `index_repository` first, then use `search_graph` / `trace_path` / `get_code_snippet` for qualified names, callers, and call chains. This map is the load-bearing grounding for a refactor — you cannot redesign what you haven't located.
- If `.grimoire/changes/<change-id>/consult.md` exists (from `grimoire-design-consult`), parse `## Inferred assumptions` and `## Inferred givens` and carry them into the `draft.md` design: assumptions → *Decided/Open* (each becomes an Open row, or a Decided row if the consult resolved it); givens → context for the *Decisions* ledger. The H2 headers `## Inferred assumptions` and `## Inferred givens` are load-bearing — they are the exact section names `grimoire-design-consult` writes; do not paraphrase, retitle, or fuzzy-match. **Open questions from `consult.md` are NOT copied** — they remain in `consult.md` as designer follow-up items.

### 6. Design the Change — the loop (the interview happens HERE)

This single loop replaces what used to be separate "elicit requirements", "draft", and
"collaborate" steps. **Interviewing IS iterating on `draft.md`.** There is no gather-then-
transcribe split — requirements surface, get questioned, and resolve inside the doc.

Iterate with the user, directly on `draft.md`:

```
loop:
  propose   → decisions into the Decisions ledger; shapes into Sketches; a diagram/sketch into At a glance
  question  → unknowns become rows under Open (use ../references/elicitation-personas.md as lenses)
  user reacts → answers / edits the doc
  resolve   → strike the Open row IN PLACE: `RESOLVED: <answer> (Dn)` — never delete it
until Decided is stable AND Open is empty-or-deferred.
```

Discipline for the loop:

1. **Outcome & Non-goals first.** Pin these (into *Why*) before anything else — they set scope. Restate them back to the user.
2. **Batch questions, then wait.** Ask 3–5 at a time, grouped by concern, as Open rows. Stop. Wait. Do not propose decisions past an unanswered batch.
3. **Ask the question; don't pre-answer it.** "Should locked accounts get an email?" — not "I'll assume locked accounts get an email." The pre-answered form lets the user nod through assumptions they'd otherwise correct.
4. **One question per real ambiguity, not a checklist dump.** Ask the few that matter for *this* change.
5. **Disambiguate immediately.** If an answer is vague ("handle errors gracefully"), ask the specific follow-up and record the concrete answer. Never leave a vague answer in the ledger.
6. **Capture, don't extrapolate.** "Out of scope for now" → record as a non-goal and stop. Don't design a scenario "just in case".
7. **When the user delegates** ("just write something reasonable"), record it explicitly as an Open→RESOLVED row: "Defaulting to <choice> per user delegation — flag in review if wrong." The assumption stays visible.
8. **Sort facts by kind as they emerge.** An invariant (security control, NFR, performance budget, observability guarantee) is not a behavior — capture it in the *Constraints* section, not as a behavioral sketch. Apply the rough behaviour-vs-invariant test as you design (does an external actor observe it without reading code/logs?) so projection's admission test (step 7) gets clean input instead of slop to reroute. The fine fact-to-home routing still happens at projection; this just keeps the design honest while you think.

**Never silently fill an open question.** Either ask it (as an *Open* row), defer it to a non-goal, or record the inference explicitly in *Decided*. The *Decided/Open* ledger IS the requirements summary — before declaring the design done, walk it back to the user so they see every call and every guess.

**Nothing is written to `features/`, `.grimoire/docs/constraints.md`, or `.grimoire/decisions/` during this loop.** Everything lives in `draft.md`. The design is "done" when *Decided* is stable and *Open* is empty-or-deferred — and the user agrees.

Do NOT proceed to projection without explicit user approval of the design.

### 7. Projection — generate the homes from draft.md

Once the user agrees the design is settled, project `draft.md` into its durable homes. This
is where the **fine routing** happens (each fact → its one home) and where the admission
test + principles gate run. Artifacts are written **live in their real locations** on the
branch — `git diff` is the staging area; there is no copy-into-the-change-folder.

First, **score the complexity level (1–4)** now that the design is settled, and write it to
`manifest.md` frontmatter as `complexity: <1-4>`.

Then project each kind of fact:

**Behaviors → `features/*.feature`.** For each behavioral fact in the design:

*The feature-file admission test* — a scenario may be written **only if it passes all four gates**; if it fails any, it is a constraint or a decision, not a feature:
1. **External actor, outside the system boundary** — an end user, an operator, or a *third-party* system integrating with you does the thing. "External" means outside *your* system, not outside one module: a sibling service, an internal queue consumer, or another module in the same repo calling this one is **internal**, even though it's a separate process. Internal actor → contract test or constraint/decision, never a `.feature`.
2. **Observable** — the actor sees the outcome without reading code or logs. "<200ms", "logs scrubbed of PII" → fails → constraint.
3. **Domain language** — domain nouns, zero implementation detail. Names a library/log-level/table (`loguru`, `INFO`, `bcrypt`, `users` table) → fails → leaking implementation.
4. **Survives reimplementation** — rewrite the internals from scratch; would the scenario still read the same? If it would change, it's pinned to implementation → not a feature.

**Internal protocols and service-to-service contracts are NOT features.** A change to how two of your own components talk — an internal RPC/queue/event shape, a module API, a wire format between your services — is a *contract*, verified by a contract/integration test (`verify: unit-invariant` at plan stage), not by Gherkin. It fails gate 1: there is no external actor, only your own code on both ends. If a third-party integrates against the protocol it's external and may be a feature; two of your own services is internal. This is the second-biggest source of feature-file slop after invariants.

Common slop this catches: invariants (→ `constraints.md`) — "PII is scrubbed from logs", "all endpoints require auth", "responses are gzipped", "errors logged with a trace id"; internal protocols (→ contract test) — "service A publishes an OrderPlaced event B consumes", "the worker accepts a job payload with these fields", "module X returns this struct to module Y".

*Extend vs. new — default is always extend; new files are the exception and require justification.* List existing feature files first (**required, not skippable** — do not write any scenario until this triage table is complete):

```
Existing feature files:
  features/auth/login.feature         — "User Login"
  features/billing/invoices.feature   — "Invoice Management"
```

For each scenario, decide extend-or-new and show it:

```
  "Admin resets a user's password"  → extend features/auth/login.feature (same actor domain: auth)
  "User configures SSO provider"    → NEW (no existing file owns SSO configuration)
```

Signals to extend: same actor, same domain object, same entry point, same HTTP resource or screen. Signals genuinely new: new actor type with no existing file, entirely new domain object, or the existing Feature title would need "and" to cover both. If unsure, extend. A new file requires stating which files were considered and why none fit.

Then write Gherkin (Feature title + user story; Background for shared preconditions; one scenario per behavior; Given/When/Then describing WHAT, never HOW). Apply security tags per `../references/security-compliance.md` (only when there's a security surface; compliance tags only when `project.compliance` is set). When design input grounded the scenarios (step 4): use brand-token **names** not hex values when `.grimoire/brand/tokens.json` applies; prefer existing component names when `.grimoire/docs/components.md` exists, and flag any net-new component ("new component required — confirm before plan stage").

**Constraints → `.grimoire/docs/constraints.md`.** Every invariant that failed the admission test (it's a security control / NFR / observability / compliance rule, not an actor-observable behavior) becomes one row: **assertion · rationale · how-verified · links**. The assertion is a flat statement ("Log output never contains PII or secrets"), not Given/When/Then. `how-verified` names the test that proves it (a `unit-invariant` the plan stage will create) — never a Gherkin scenario. If it stems from a decision, link the MADR; don't restate it. Create the file from `templates/constraints.md` if absent.

**Decisions → `.grimoire/decisions/NNNN-*.md`.** Project each Decisions-ledger entry, applying the **novelty gate**: a MADR is for a decision with a real, project-specific trade-off between viable alternatives — not for industry-default tooling picks or ecosystem-forced conventions. Ask: *would a competent engineer on this stack make a different choice, and need our reasoning to understand ours?* If no, skip it. Obvious tooling/convention picks fold into the existing `Tooling and convention baseline` ADR (one line: choice → why), not a new sequential record. Genuine trade-offs get the next sequential number, status `proposed` (`grimoire-apply` flips to `accepted` at finalize), using `.grimoire/decisions/template.md`.

**Data changes → `.grimoire/changes/<change-id>/data.yml`.** If the change adds/modifies/removes data models, fields, indexes, or external API integrations, write `data.yml` (same YAML shape as `schema.yml`, only what's changing, `action:` on each entry):

```yaml
# Proposed data changes for: add-user-profiles
users:
  action: modify
  source: src/models/user.py
  fields:
    avatar_url: { action: add, type: varchar, nullable: true }
    legacy_name: { action: remove }
profiles:
  action: add
  type: collection
  fields:
    user_id: { type: objectId, ref: users }
    bio: { type: string, max_length: 500 }
github_api:
  action: add
  type: external_api
  provider: GitHub
  schema_ref: https://docs.github.com/en/rest
  client: src/integrations/github.py
  endpoints:
    get_user:
      method: GET
      path: /users/{username}
      request:
        headers: { Authorization: "Bearer {token}" }
      response:
        login: { type: string, required: true }
        avatar_url: { type: string, required: true }
        name: { type: string, nullable: true }
      error_response:
        message: { type: string }
        status: { type: integer }
```

**Contract documentation is mandatory for external APIs.** Every endpoint must document `request` (what you send), `response` (fields you read, `required: true` for those your code depends on), and `error_response` (the error shape you handle). Downstream skills generate contract tests from this. If you don't know the exact shape, reference `schema_ref` and document the subset your client uses — that subset is the contract. No data impact → skip `data.yml` entirely.

**Manifest (`manifest.md`).** Generate it from `draft.md` as the durable plan-input glue: `complexity` (just scored), Why + Non-goals, the artifact list (added/modified/removed features, decisions, constraints), and a **Prior Art** section summarizing step 3's research (what was found/evaluated, why adopt/build/hybrid; if building, what's borrowed). **Level 3–4** also carry **Assumptions** (what must be true; mark evidence vs. unvalidated; flag unvalidated ones on the critical path) and a **Pre-Mortem** (2–5 plausible failure modes 6 months out, with mitigations or "accepted"). These come straight from the `draft.md` Decided/Open and Cut sections.

**Do NOT delete `draft.md`.** Retain it read-only as the agreed reference through plan → … → apply. `grimoire-apply` removes it with the change folder at finalize.

### 8. Validate (at projection)

- `.feature` files have valid Gherkin; every Feature has a user story; every Scenario has at least Given + When + Then.
- MADR records have valid YAML frontmatter (status, date).
- Manifest is complete and accurate; `complexity` is set.
- **Re-run the admission test on every scenario you wrote**: external actor, observable, domain language, survives reimplementation. Any scenario that now fails is slop — move it to `constraints.md` or a MADR.
- **Principles gate** (`../references/principles.md`): no fact written to two homes (DRY), no second way to do an existing thing (one right way), no reinvented wheel, no artifact created past the stated scope (KISS). Note: `draft.md` co-existing with the homes is **not** a DRY violation — it is the (soon-deleted) source the homes were projected from, not a parallel authority.

## Important
- ONE change at a time. Don't combine unrelated changes.
- **`draft.md` is the only surface you design on.** Features, constraints, MADRs, and the manifest are **generated from it** at projection — never authored by hand in parallel during design.
- **Features describe actor-observable behavior, not implementation, and not invariants.** No external actor, not observable, or names a library/log-level/table → it's a constraint (→ `constraints.md`) or a decision (→ MADR). An internal protocol or service-to-service contract (your own components talking) is a contract test, not a `.feature` — "external" means outside your system, not outside one module. These two — invariants and internal protocols — are the top sources of feature-file slop.
- **One fact, one home** (`../references/principles.md`). A capability lives in one `.feature`; a control in one constraint row; a decision in one MADR. Never the same fact in two homes (at rest).
- Decisions live in **one inline ledger** in `draft.md` while designing; they project to separate MADRs only at step 7. This is how coupled decisions stay legible during the thinking.
- Artifacts (post-projection) are edited **live on the branch** — never copied into `.grimoire/changes/`. `git diff` is the staging area.
- **Figma access token is read from `FIGMA_ACCESS_TOKEN` by the MCP server.** Never log it, never write it to config or any artifact (`manifest.md`, `consult.md`, `figma-snapshot.json`, `draft.md`). The MCP handles auth transparently.

## Done
When the user approves the design and it has been projected, the workflow is complete.
`draft.md` remains as reference until `grimoire-apply` clears it. Present the change
directory path and suggest next steps:
- `grimoire-plan` to generate implementation tasks
- Or further iteration on `draft.md` if the user wants changes
