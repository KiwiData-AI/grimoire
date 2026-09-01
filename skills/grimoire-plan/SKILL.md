---
name: grimoire-plan
description: Project an agreed draft.md into its homes (features, constraints, decisions, manifest), then derive implementation tasks from them. Use after the design is approved in grimoire-draft.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-plan

Plan opens by **projecting** the agreed `draft.md` into its durable homes (features, constraints, decisions, `data.yml`, manifest), then derives implementation tasks from them. The output must be detailed enough that any LLM can execute the tasks without further planning.

## Triggers
- User has approved a grimoire draft and wants to plan implementation
- User asks to create tasks or plan work for a grimoire change
- Loose match: "plan", "tasks" with a change reference

## Routing
- No approved change exists → `grimoire-draft` first
- Change is Level 1 (trivial) → plan is optional; suggest applying directly with minimal tasks
- User wants to review the design → `grimoire-review` (after plan, before apply)

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with an agreed `draft.md` — the user has approved the design in `grimoire-draft`. Plan's first step **projects** that design into its homes (features, constraints, MADRs, `data.yml`, manifest); those do not need to exist yet.

## Workflow

### Operating Rules (apply to every step)

**1. Verify, don't delegate.** Any claim that can be answered by reading the codebase is *your* job — do it now, do not punt it to the implementer or the user. Forbidden task shapes:

- "Check whether `foo()` is already used somewhere"
- "Verify if module X exists"
- "Confirm the import path for Y"
- "See if there's an existing utility for Z"
- "TODO: check if this conflicts with…"

Resolve each one yourself before writing the task. Tools: codebase-memory-mcp (`search_graph`, `trace_path`, `get_code_snippet`) for symbols and reusable code, `.grimoire/docs/<area>.md` for conventions/boundaries, `Grep`, neighbor files. The task should state the *answer* ("Reuse `parse_invoice` in `src/billing/parsing.py:42`" or "No existing utility — write new"), never the *question*.

**2. Clarify or propose, never assume.** When the spec is ambiguous or silent on something you need to plan:

- **Ambiguous** (spec contradicts itself, two readings are plausible) → ask the user one specific question. Do not pick a reading and proceed.
- **Silent on a scenario you think is needed** (e.g., "what if the login attempt rate-limits?") → propose adding it. Route back to `grimoire-draft` for the spec update, or ask the user to confirm before you add a corresponding task. **Do not silently invent scenarios, edge cases, or tasks not derivable from approved features / ADRs / `data.yml` / manifest sections.**
- **Confident** (spec is clear or the unstated detail follows obviously from project conventions) → plan, but note the inference in a `<!-- inferred: ... -->` comment so the user can override.

The plan implements what's approved. It does not expand scope to hit a checklist.

**3. Plan to the principles.** Every task is gated by the four principles in `../references/principles.md` — **one right way, DRY, don't reinvent the wheel, keep it simple.** Concretely, before writing each task:
- **One right way:** name the single sanctioned approach. If the spec leaves two ways open, pick one (record why in the task) — never plan both.
- **DRY:** reuse before write (search the graph); don't plan a task that stores a fact already derivable from code/mcp or already homed elsewhere.
- **Don't reinvent:** prefer an existing tool/library/proven pattern over a bespoke mechanism. git for change process, standard libs for crypto/auth/parsing.
- **Keep it simple:** choose the least-code option inside the non-goals. Flag any task that adds an abstraction, a dependency, or a second mechanism — it needs an explicit reason.

These are gates, not aspirations — a task that adds a duplicate home or a reinvented wheel is rejected, not refined.

### 1. Project the Design from draft.md

**Select the change.** List active changes in `.grimoire/changes/`; if multiple, ask which to plan; if one, confirm it. Read its `draft.md` — the agreed design is the source of truth for this step. (If a change arrives already projected and has no `draft.md` — e.g. from `grimoire-refactor`, which authors its own register and artifacts — there is nothing to project: skip to step 2.)

**Project `draft.md` into its durable homes.** This is where the **fine routing** happens (each fact → its one home) and where the admission test + principles gate run. Artifacts are written **live in their real locations** on the branch — `git diff` is the staging area; there is no copy-into-the-change-folder. (Projection used to close `grimoire-draft`; it now opens plan, co-located with the planning that consumes these homes.)

First, **score the complexity level (1–4)** now that the design is settled, and write it to `manifest.md` frontmatter as `complexity: <1-4>` (use the level table in `grimoire-draft` step 2 as the rubric). Then project each kind of fact:

**Behaviors → `features/*.feature`.** Extend an existing feature only for clear actor-visible behavior. A change may require no Gherkin edits.

*The feature-file admission test* — a scenario may be written **only if it passes all four gates**; if it fails any, it is a constraint or a decision, not a feature:
1. **External actor, outside the system boundary** — an end user, an operator, or a *third-party* system integrating with you does the thing. "External" means outside *your* system, not outside one module: a sibling service, an internal queue consumer, or another module in the same repo calling this one is **internal**, even though it's a separate process. Internal actor → contract test or constraint/decision, never a `.feature`.
2. **Observable** — the actor sees the outcome without reading code or logs. "<200ms", "logs scrubbed of PII" → fails → constraint.
3. **Domain language** — domain nouns, zero implementation detail. Names a library/log-level/table (`loguru`, `INFO`, `bcrypt`, `users` table) → fails → leaking implementation.
4. **Survives reimplementation** — rewrite the internals from scratch; would the scenario still read the same? If it would change, it's pinned to implementation → not a feature.

**Internal protocols and service-to-service contracts are NOT features.** A change to how two of your own components talk — an internal RPC/queue/event shape, a module API, a wire format between your services — is a *contract*, verified by a contract/integration test (`verify: unit-invariant`), not by Gherkin. It fails gate 1: there is no external actor, only your own code on both ends. If a third-party integrates against the protocol it's external and may be a feature; two of your own services is internal. This is the second-biggest source of feature-file slop after invariants.

Common slop this catches: invariants (→ `constraints.md`) — "PII is scrubbed from logs", "all endpoints require auth", "responses are gzipped", "errors logged with a trace id"; internal protocols (→ contract test) — "service A publishes an OrderPlaced event B consumes", "the worker accepts a job payload with these fields", "module X returns this struct to module Y".

Internal nuances, refactors, and optimizations use unit, characterization, contract, benchmark, constraint, or ADR verification. Do not create or modify Gherkin merely to give internal work a scenario.

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

Then write Gherkin (Feature title + user story; Background for shared preconditions; one scenario per behavior; Given/When/Then describing WHAT, never HOW). Apply security tags per `../references/security-compliance.md` (only when there's a security surface; compliance tags only when `project.compliance` is set). When design input grounded the scenarios (the change's `designs/` folder): use brand-token **names** not hex values when `.grimoire/brand/tokens.json` applies; prefer existing component names when `.grimoire/docs/components.md` exists, and flag any net-new component ("new component required — confirm before generating tasks").

**Constraints → `.grimoire/docs/constraints.md`.** Every invariant that failed the admission test (it's a security control / NFR / observability / compliance rule, not an actor-observable behavior) becomes one row: **assertion · rationale · how-verified · links**. The assertion is a flat statement ("Log output never contains PII or secrets"), not Given/When/Then. `how-verified` names the test that proves it (a `unit-invariant` this plan creates) — never a Gherkin scenario. If it stems from a decision, link the MADR; don't restate it. Create the file from `templates/constraints.md` if absent.

**Decisions → `.grimoire/decisions/NNNN-*.md`.** Project each Decisions-ledger entry (a Y-statement in `draft.md`), applying the **novelty gate**: a MADR is for a decision with a real, project-specific trade-off between viable alternatives — not for industry-default tooling picks or ecosystem-forced conventions. Ask: *would a competent engineer on this stack make a different choice, and need our reasoning to understand ours?* If no, skip it. Obvious tooling/convention picks fold into the existing `Tooling and convention baseline` ADR (one line: choice → why), not a new sequential record. Genuine trade-offs get the next sequential number, status `proposed` (`grimoire-apply` flips to `accepted` at finalize), using `.grimoire/decisions/template.md` — the Y-statement's context clause becomes the ADR's *Context and Problem Statement*.

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

**Contract documentation is mandatory for external APIs.** Every endpoint must document `request` (what you send), `response` (fields you read, `required: true` for those your code depends on), and `error_response` (the error shape you handle). The task-generation step below turns this into contract tests. If you don't know the exact shape, reference `schema_ref` and document the subset your client uses — that subset is the contract. No data impact → skip `data.yml` entirely.

**Manifest (`manifest.md`).** Generate it from `draft.md` as the durable plan glue: `complexity` (just scored), Why + Non-goals, the artifact list (added/modified/removed features, decisions, constraints), and a **Prior Art** section summarizing the build-vs-buy research captured in `draft.md` (what was found/evaluated, why adopt/build/hybrid; if building, what's borrowed). **Level 3–4** also carry **Assumptions** (what must be true; mark evidence vs. unvalidated; flag unvalidated ones on the critical path) and a **Pre-Mortem** (2–5 plausible failure modes 6 months out, with mitigations or "accepted"). These come straight from the `draft.md` Decided/Open and Cut sections.

**Do NOT delete `draft.md`.** Retain it read-only as the agreed reference through the rest of plan → apply. `grimoire-apply` removes it with the change folder at finalize.

**Validate the projection** before moving on:
- `.feature` files have valid Gherkin; every Feature has a user story; every Scenario has at least Given + When + Then.
- MADR records have valid YAML frontmatter (status, date).
- Manifest is complete and accurate; `complexity` is set.
- **Re-run the admission test on every scenario you wrote**: external actor, observable, domain language, survives reimplementation. Any scenario that now fails is slop — move it to `constraints.md` or a MADR.
- **Principles gate** (`../references/principles.md`): no fact written to two homes (DRY), no second way to do an existing thing (one right way), no reinvented wheel, no artifact created past the stated scope (KISS). `draft.md` co-existing with the homes is **not** a DRY violation — it is the (soon-deleted) source the homes were projected from.

The homes now exist; the rest of plan reads and breaks them into tasks.

### 2. Read All Artifacts

Read the change's artifacts following `../references/artifact-map.md` — it defines what each file is, the grimoire-docs-first / graph-for-structure discipline, the **reading-altitude** rule (read contracts and signatures, not internal source or unit tests), and the staleness gate. Plan-specific reading on top of that:

- `.grimoire/docs/constraints.md` — any constraints (security/NFR/observability) this change touches. These produce `unit-invariant` tasks, not scenarios.
- The current baseline (`features/`, `.grimoire/decisions/`) via `git diff main` — exactly what this change adds vs. what already existed.
- Existing duplication in areas you're touching — `search_graph` for similar functions, or `grimoire health` (its `duplicates` metric) — so tasks consolidate rather than clone.

**Validate the build-vs-buy decision:**
- Check that `manifest.md` has a **Prior Art** section documenting what existing solutions were researched. If it's missing or empty, **stop and tell the user** — planning without a build-vs-buy analysis produces plans that ignore cheaper alternatives.
- If the decision was to **adopt** a library/service, the plan tasks should focus on integration, configuration, and contract testing — not reimplementation.
- If the decision was to **build custom**, verify the manifest documents (1) what existing tools were considered, (2) the specific requirements they don't meet, and (3) what design patterns are being borrowed from prior art.
- If the decision was **hybrid** (adopt for part, build for part), ensure the boundary between adopted and custom code is clear in the tasks.

### 3. Check Specification Completeness

Before generating tasks, evaluate whether the specifications are detailed enough to plan against. Underspecified requirements produce vague tasks, which produce wrong code.

**Flag real gaps only — do not manufacture issues to hit a checklist.** A "gap" exists when:
- The spec contradicts itself (a scenario violates a non-goal; two scenarios disagree).
- A scenario you need to plan against has missing detail you cannot infer from project conventions (e.g., "redirect to dashboard" — which dashboard URL?).
- The manifest is missing a section the complexity level requires (Assumptions / Pre-Mortem / Prior Art on level 3-4).
- A scenario references an external API or data model with no contract in `data.yml` / `schema.yml`.

**Not a gap** (do not flag):
- The spec doesn't include a scenario you personally would have added. The approved feature set is the scope. If you think a scenario is missing, see "Clarify or propose, never assume" in Operating Rules — propose it back to draft, do not silently add planning for it.
- A negative path is unspecified but project conventions make it obvious (e.g., invalid input returns 400 — that's the framework default, not a spec gap).
- A non-functional concern (perf, observability) is unspecified at level 1-2.

#### Outcome & Scope check
- Does the manifest have a clear **Why** that describes the outcome, not just the mechanism? ("Users can reset passwords" not "Add password reset endpoint.")
- Does the manifest have a **Non-goals** section? If missing or empty on a level 3-4 change, flag it — without non-goals, scope creep is invisible during implementation.
- Do any scenarios appear to implement something listed as a non-goal? Flag as **blocker** — the draft contradicts itself.

Persona lens (only those relevant to the change) — see `../references/elicitation-personas.md` for the full set:

- **Outcome & Scope**: Why states outcome (not mechanism)? Non-goals exist? No scenario contradicts a non-goal?
- **PM**: User stories present? Given/When/Then specific?
- **Engineer**: Critical-path assumptions validated or flagged? Prior art documented (if building custom)?
- **Security**: Scenarios with auth/input/sensitive-data tags have corresponding constraints? Quality Attribute targets not blank?
- **Data**: External APIs or new models have `data.yml`? Constraints (required/unique/nullable) specified?
- **QA**: Where the spec explicitly references an error path, is the expected behavior specified?

**Response paths when a gap is found:**

1. **Ambiguous** (the spec is contradictory or admits two readings) → ask the user one specific question. Do not pick a reading.
2. **Missing scenario the planner believes is required** → propose adding it via `grimoire-draft`. State the rationale ("this feature handles money — failure-path behavior should be in the spec"). Do not silently add a planning task for it.
3. **Missing detail derivable from conventions** → infer, plan, and annotate the task with `<!-- inferred: ... -->` so the user can override.
4. **Missing manifest section the complexity level requires** → ask the user; flag as a gate for level 3-4.

If multiple gaps are found, batch them and present once. Wait for the user's response before generating tasks.

Level 1-2 changes with minor gaps may proceed; level 3-4 with multiple gaps should not.

**If no real gaps**, proceed directly to task generation.

### 4. Generate Tasks
Create `.grimoire/changes/<change-id>/tasks.md`. **Every task is one vertical checkbox containing its test and production change.** The test level matches the artifact the task derives from. Within the checkbox, the failing test comes first.

**Build an executable section order before task approval.** Default to one substantial implementation section. Use a second section only for a distinct outcome or context boundary. Every section beyond two requires a specific outcome, dependency, or context-boundary justification. Never create sections for technical layers, error cases, tests, verification, pattern establishment, or repetition alone.

When multiple sections exist, derive the actual section dependency graph from referenced symbols, imports, schema and migration prerequisites, generated artifacts, fixtures, routes, and context files. Do not infer order from section titles or the technical spine.

Topologically sort the sections. Use the technical spine only as a tie-breaker
among independent sections. The spine order is dependencies → data/schema →
API/contract → business logic → UI by component → verification. Assign section
IDs after sorting, then represent every implementation section with exactly one
dependency comment:

```markdown
<!-- depends-on: none | <earlier section IDs> -->
```

Use `none` only when the section has no prerequisites. A dependency may reference
only an earlier section ID. Within each section, order tasks so no task requires
a later task. Keep test-first order inside each dependency layer.

Validate the complete graph before presenting the plan. Collect missing
dependency metadata, unknown section IDs, forward dependencies, and cycles.
Report all dependency errors together and block plan approval. Do not silently
drop, rewrite, or reorder an invalid dependency declaration.

**Assign review timing before task approval.** Every implementation activity checkbox declares `<!-- review: structure-before -->` or `<!-- review: slice-after -->` immediately beneath it.

- Use `structure-before` for data models, repository layout, ownership boundaries, public interfaces, DRY-sensitive structure, performance-sensitive structure, and other costly-to-reverse shapes.
- Use `slice-after` when the agent may implement directly and the activity can join the consolidated pre-commit review.
- Review timing controls when the user reviews the activity. It does not restrict production-file editing.
- Optional per-file review belongs to the agent harness, not `tasks.md`.

**Keep autonomous implementation uninterrupted.** Autonomous sections contain
no human approval, manual inspection, ask-the-user, or wait tasks. Convert
verification to deterministic commands or agent-executable tools. A command or
tool must state its exact success condition.

If required external acceptance cannot be automated or executed by an agent,
consolidate every such gate into one terminal `External acceptance` section
after all implementation and verification sections. Do not mark that section
as autonomous implementation. Its `depends-on` comment names every implementation
and verification prerequisite. No human gate may interrupt implementation. In
the approval presentation, state that the plan is not autonomous end-to-end and
obtain agreement during plan approval.

Before presenting tasks for approval, include a complete strategy table before the first task:

| Section | Depends on | Activities | Review timing | Section justification |
|---------|------------|------------|---------------|-----------------------|
| <section title> | `none` or earlier section IDs | <task IDs> | <timing per task> | <distinct outcome or context boundary> |

The user reviews and approves this complete table with the task list. Do not begin implementation from a plan without approved section strategy metadata.

**Tag every implementation task with a `verify:` level** — this tells `grimoire-apply` which test vehicle to use. Match the artifact:

| Task derives from | `verify:` | Test vehicle |
|-------------------|-----------|--------------|
| a `.feature` scenario (actor-observable behavior) | `scenario` | step definitions + Gherkin |
| a constraint in `constraints.md` (security/NFR/observability) | `unit-invariant` | unit/integration test asserting the invariant |
| an internal protocol / service-to-service contract (internal RPC, queue/event shape, module API between your own components) | `unit-invariant` | contract/integration test asserting the wire shape both ends agree on |
| an ADR consequence, refactor, or internal change with no spec | `characterization` | unit / characterization test |

**Do not plan a `.feature` scenario task for a constraint, an internal protocol, or an internal change.** Constraints and internal protocols get `unit-invariant` tests (a contract test for a protocol asserts the payload/event shape both ends agree on); other internal changes get `characterization` tests. Forcing Gherkin onto a non-behavioral concern is the antipattern that fills feature files with slop (one right way: external actor-observable behavior → scenario, everything else — invariants, internal protocols, refactors → unit/contract test). If a `.feature` in the change actually describes an internal protocol (slop that slipped past draft), flag it and route the task to `unit-invariant`, don't write step definitions for it.

**THE PLAN'S SCOPE IS WHAT WAS APPROVED.** Tasks may only derive from:
- `.feature` scenarios in this change → `verify: scenario`
- Constraints added/touched in `.grimoire/docs/constraints.md` → `verify: unit-invariant`
- ADRs in this change (and their Confirmation sections) → `verify: unit-invariant` or `characterization`
- `data.yml` entries in this change
- The manifest's Assumptions, Pre-Mortem mitigations, and Prior Art borrowings
- ADR confirmation checks performed by the task implementing that decision

Do not add tasks for scenarios you wish existed, edge cases you imagine, observability you'd like, or refactors you'd prefer. If you think one is needed, see Operating Rules §2 — propose, don't insert.

**THE PLAN MUST RESPECT NON-GOALS.** Read the manifest's Non-goals section. If a task would touch, implement, or extend something listed as a non-goal, do not include it. If you think a non-goal should be reconsidered, flag it to the user — don't silently include it.

**THE PLAN MUST BE SPECIFIC ENOUGH TO EXECUTE WITHOUT FURTHER PLANNING.** Specific means *answered*, not *delegated*: file paths resolved (not "find the right file"), reusable utilities named with exact symbol + path (not "check if one exists"), import paths verified (not "confirm the import"). See Operating Rules §1.

The approved outcomes and source artifacts remain authoritative. Implementation mechanics are correctable details. Apply user-directed corrections immediately. Record one terse implementation lesson only when the correction affects remaining work, update only affected unchecked tasks, and continue without plan-wide reconciliation.

**THE PLAN MUST PREFER SIMPLICITY.** For each task, choose the approach with the least code, fewest new files, and smallest surface area. If a task can be solved by adding a few lines to an existing file, don't create a new module. If a standard library function does the job, don't pull in a dependency. If three lines of inline code are clearer than a helper, keep them inline. Flag any task that introduces a new abstraction, utility, or pattern — it needs a reason.

**THE PLAN MUST USE PROVEN PATTERNS, NOT INVENT NEW ONES.** When the task fits a well-known pattern, name it and follow it:
- **Data pipelines** → ETL (Extract, Transform, Load) or ELT. Name stages explicitly. Don't invent a bespoke "data flow."
- **Web applications** → MVC, MVP, or MVVM depending on the framework's conventions. Follow the framework, don't fight it.
- **APIs** → RESTful resource design, or the project's existing API style. Don't mix conventions.
- **Background jobs** → Producer/consumer, pub/sub, or the framework's job/task pattern (e.g., Celery tasks, Bull queues).
- **State management** → Use the framework's idiomatic approach (Redux, Vuex, signals, etc.), not a hand-rolled event system.
- **Authentication & security** → Always recommend proven security processes: OAuth2/OIDC for auth flows, bcrypt/argon2 for password hashing, CSRF protection for forms, parameterized queries for database access. Never roll custom crypto, custom auth tokens, or custom session management when a battle-tested library exists.

**THE PLAN MUST RESPECT SECURITY TAGS AND COMPLIANCE.**
Check `.grimoire/config.yaml` under `project.compliance`. When scenarios have security tags, the plan must include corresponding tasks per `../references/security-compliance.md` (section "What Each Tag Requires — In planning").

If no compliance frameworks are configured and no security tags are present, skip this.

If no established pattern applies, state that explicitly in the task and explain why.

**THE PLAN MUST ENFORCE SINGLE RESPONSIBILITY.** Each file, class, and function should do one thing:
- A function that fetches data should not also format it for display
- A class that manages database access should not also handle HTTP responses
- A module that defines routes should not also contain business logic
- If a task description combines two distinct responsibilities (e.g., "fetch and render", "validate and persist"), split it into separate tasks or explicitly call out the boundary in the task description
- When planning new files, each file should have a clear, singular purpose. Name it after what it does, not what feature it supports

**THE PLAN MUST USE CLEAR NAMING AND FLAT STRUCTURE.**
- Variables, functions, classes, and files must have descriptive names that reveal intent — `calculate_invoice_total` not `calc`, `UserAuthenticationService` not `UAS`, `test_login_redirects_to_dashboard` not `test_login_1`
- Avoid abbreviations unless they are universally understood in the domain (e.g., `URL`, `HTTP`, `ID`)
- Avoid deep nesting: if a task would produce code with more than 3 levels of indentation, restructure it. Use early returns/guard clauses, extract helper functions, or use pipeline/chain patterns. The plan should call this out explicitly when the task involves conditional or iterative logic

Each task must include:
- **What file(s) to create or edit** — exact paths, not vague references
- **What to implement** — specific functions, classes, views, routes, not just "implement the feature"
- **Which source artifact it satisfies** — scenario, constraint, decision, contract, manifest risk, or internal outcome
- **What the test should assert** — the exact expected behavior or invariant, not just "write a test"

Bad task (too vague — will trigger re-planning):
```
- [ ] 1.1 Implement login with 2FA
```

Good task (specific enough to execute):
```
- [ ] 1.1 (verify: scenario) Complete successful TOTP login in `tests/step_defs/test_auth.py` and `auth/views.py`.
      <!-- review: structure-before -->
      - Test: assert POST `/verify-totp/` returns status 302 and redirects to `/dashboard/`.
      - Implement: add `VerifyTOTPView` validation and authenticated-session behavior.
      - Red/green: `python manage.py test auth.tests.TestTotpLogin.test_valid --keepdb`.
```

**From feature scenarios:**
- Each new or modified scenario → one vertical task containing the step-definition change and production implementation
- Group by capability/feature file
- Within the task, step definitions come before production code
- **Use the project's configured BDD tool** — check `.grimoire/config.yaml` under `tools.bdd_test` for the test runner (e.g., `behave`, `pytest-bdd`, `cucumber-js`, `cucumber`). Step definitions must follow that tool's conventions:
  - **behave** (Python): step defs in `features/steps/`, use `@given`, `@when`, `@then` decorators from `behave`
  - **pytest-bdd** (Python): step defs alongside tests, use `@scenario`, `@given`, `@when`, `@then` from `pytest_bdd`
  - **cucumber-js** (JS/TS): step defs in `features/step_definitions/`, use `Given`, `When`, `Then` from `@cucumber/cucumber`
  - If no BDD tool is configured, check the existing test directory structure and imports to infer which framework is in use

**From decisions:**
- Each decision → implementation task(s) with specific files and changes
- If the ADR has a Confirmation section → add a test/check task for it

**Shared step definitions:**
- Identify steps that will be reused across scenarios (Given steps especially)
- These go in the project's common step location (check existing test setup)
- Group by domain concept, NOT by feature file

**From data.yml (if present):**
- Each new model → migration task + ORM/schema task
- Each modified field → migration task (specify: is it safe to run live? nullable? default?)
- Each removed field → migration task with data cleanup if needed
- Each new external API → client wrapper task referencing `schema_ref` for the full contract
- Each new or modified external API → **contract validation test task** that asserts the client's request/response shapes match the contract documented in `data.yml` / `schema.yml`. The test should:
  - Validate that every `required: true` response field is read and typed correctly in the client
  - Validate that request payloads match the documented shape (required fields present, types correct)
  - Validate error response handling matches the documented `error_response` shape
  - Use a recorded/fixture response (not a live call) so the test runs locally without network access
- Each modified external API client (existing API, changed usage) → **contract regression test** that catches if the client drifts from the documented contract. If the client starts reading a new field or stops sending a required field, the test must fail.
- Data tasks come BEFORE feature implementation tasks — the models must exist before code that uses them
- Order: schema/model changes → migrations → contract tests → seed data (if any) → then feature code

**Mocking strategy for external services:**
Follow the rules in `../references/testing-contracts.md`. Key points: mock at HTTP boundary (not client), fixtures must match `schema.yml`, include error fixtures. Each contract test task must specify: (1) which HTTP mocking library, (2) which fixture file, (3) what the fixture contains (from `schema.yml`).

**Test data:** Do not add tasks that ask the user for sample data or example scenarios. Per `../references/testing-contracts.md` (Test Data Generation), every test task that needs data must name the generation source — the project's existing data factory / property-based tool (`factory_boy`, `@faker-js/faker`, `model_bakery`, `Hypothesis`, `fast-check`, etc., detected from `config.tools` / existing test imports), and which fields the scenario pins vs. lets the factory fill. AI-authored literal data is a last resort: only plan it when the user explicitly asked for generated data, or no factory exists and a specific crafted value is needed — and say which in the task. If the project has no data-factory tooling and the change clearly needs one, surface adopting it as a build-vs-buy line, don't smuggle the dependency into an implementation task.

**From manifest Assumptions:**
- Each unvalidated assumption on the critical path → a verification task (spike, proof-of-concept, or integration test that confirms the assumption holds)
- If an assumption turns out to be wrong during planning, flag it to the user — it may invalidate the change

**From manifest Pre-Mortem:**
- Each failure mode with a mitigation → the mitigation becomes a task or an edge case to cover in an existing task
- Each failure mode marked "accepted" → add a comment in the relevant code or test noting the accepted risk, so future developers understand the trade-off
- Pre-mortem risks may reveal missing verification. Use Gherkin only when the risk describes clear actor-visible behavior; otherwise use the matching internal test or check.

**From decision Cost of Ownership:**
- Prefer implementation approaches that minimize the maintenance burden identified in the ADR
- If the ADR identifies sunset criteria, add a task to document them where they'll be seen (e.g., a comment in config, a monitoring alert, or a calendar reminder)
- If maintenance burden is high, prefer simpler alternatives even if they're less elegant

**From manifest Prior Art (when building custom):**
- If the manifest identifies design patterns borrowed from existing tools, tasks must follow those patterns — don't reinvent what the prior art already refined
- If the manifest identifies specific data flows or API shapes from existing tools, reference them in the task descriptions so the implementing agent understands the intent
- If the prior art research surfaced an existing tool that covers part of the need, consider whether the plan should adopt it for that part instead of building everything custom — flag this to the user as a simplification opportunity
- If a library was rejected for a specific reason (e.g., doesn't support X), add a comment to the relevant task noting this so future developers don't re-evaluate the same option

**Existing code to reuse:**
- Query the graph (`search_graph` by concept/name) for existing utilities that apply to this change; area docs give conventions, the graph gives the reusable symbols
- If `grimoire health`/mcp shows existing clones in the area you're touching, tasks should consolidate rather than add more
- Add a "Reuse" section at the top of tasks.md listing specific functions/classes to import instead of rewriting

**Tactical red-green command:** Each checkbox contains the test change, production change, and one exact tactical command used for red and green. The tactical command selects only new or changed tests and uses only a runner accelerator verified from project configuration or existing commands. Examples include Django `--keepdb` and pytest-django `--reuse-db` only when the repository proves support. Final verification is absent from task sections; apply invokes `grimoire-verify` once after implementation.

### 5. Task Format
The tasks file starts with a context block so any LLM can orient without re-reading every artifact. Each task section includes a `<!-- context: ... -->` block listing the exact files an agent should load before working on that section. This is critical for reducing context rot — each task or task group can run in a fresh session that loads only what it needs.

```markdown
# Tasks: <change-id>

> **Change**: <one-line summary from manifest>
> **Features**: <list of changed .feature files, or "none">
> **Decisions**: <list of ADRs in this change, or "none">
> **Baseline commands**: `<configured unit and BDD suite commands>`
> **Status**: X/Y tasks complete

## Approved strategy

| Section | Depends on | Activities | Review timing | Section justification |
|---------|------------|------------|---------------|-----------------------|
| <Capability outcome> | `none` | 1.1, 1.2 | 1.1 `structure-before`; 1.2 `slice-after` | Primary implementation outcome. |

## 1. <Capability outcome>
<!-- depends-on: none -->
<!-- context:
  - features/<name>.feature
  - .grimoire/docs/<area>.md
  - src/<area>/<file-to-edit>.ts
  - tests/<area>/<test-file>.ts
-->
- [ ] 1.1 (verify: scenario) Complete "<scenario name>" in `<exact test and production paths>`.
      <!-- review: structure-before -->
      - Test: <specific new or changed test and exact assertion>.
      - Implement: <specific production symbols and behavior>.
      - Red/green: `<exact command selecting only this new or changed test, with a verified accelerator when available>`.

- [ ] 1.2 (verify: characterization) Complete `<internal outcome>` in `<exact test and production paths>`.
      <!-- review: slice-after -->
      - Test: <specific characterization test and exact assertion>.
      - Implement: <specific production symbols and behavior>.
      - Red/green: `<exact command selecting only this new or changed test>`.
```

**Context blocks are mandatory.** Every task section must have a `<!-- context: ... -->` listing the files needed. This serves two purposes:
1. **Fresh sessions:** An agent starting a new session loads only the context block for its current section, avoiding accumulated noise from prior work
2. **Subagent delegation:** In Claude Code, the parent agent passes the context list when spawning a subagent for a task group

### 6. Quality Check
Before presenting to the user, verify the plan:
- [ ] Every task references a specific file path (no "implement the feature")
- [ ] Every implementation task carries a `verify:` tag matching its source artifact — `scenario` only for `.feature` behavior; `unit-invariant` for constraints; `characterization` for internal/refactor. No `.feature` scenario task for a constraint or internal change.
- [ ] Every test task describes what to assert (no "write a test")
- [ ] Every implementation task describes what to create/modify (no "add the code")
- [ ] Each task combines its test and production change in one vertical checkbox.
- [ ] Each task has one exact tactical command used for red and green.
- [ ] Each tactical command selects only new or changed tests and uses only verified runner accelerators.
- [ ] No task or section runs final verification or a full configured suite.
- [ ] The technical spine orders only independent sections: dependencies → data/schema → API/contract → logic → UI → verification.
- [ ] Actual section dependencies were derived from referenced code and artifacts; sections are topologically sorted, with the technical spine used only to break ties.
- [ ] Every implementation section has one `depends-on` comment; each dependency exists, points backward, and creates no cycle.
- [ ] Tasks within each section are ordered so no task requires a later task.
- [ ] Every implementation activity has one review marker immediately beneath its checkbox.
- [ ] The complete activity review-timing table appears before the first task and is ready for user approval.
- [ ] Autonomous sections contain only deterministic commands or agent-executable work and contain no human gate.
- [ ] Any unavoidable external acceptance is consolidated into one terminal section; plan approval explicitly agrees that execution is not autonomous end-to-end.
- [ ] The plan defaults to one substantial section, uses two only for distinct outcomes or context boundaries, and justifies every section beyond two.
- [ ] No task requires the LLM to make architectural decisions — those should already be in the ADR
- [ ] **Principles gate** (`../references/principles.md`): no task introduces a duplicate home for an existing fact (DRY), a second way to do an existing thing (one right way), a reinvented wheel where a tool/library/proven pattern exists (don't reinvent), or an abstraction/dependency justified only by a hypothetical (KISS). Any that does has a stated reason.

If any task is too vague, make it more specific before presenting. Read more codebase if needed.

### 7. Present to User
- Present tasks to user
- Confirm dependency order, scope, and section strategy
- If an `External acceptance` section exists, obtain explicit agreement that the plan is not autonomous end-to-end
- Adjust based on feedback

### 8. Design Review
- Once the user approves the tasks, suggest running `grimoire-review` for a multi-perspective design review
- **Complexity 1**: Skip review — suggest proceeding directly to `grimoire-apply`
- **Complexity 2-3**: Review is **optional** — the user can skip it and go straight to `grimoire-apply`
- **Complexity 4**: Review is **mandatory** — do not suggest skipping
- If the user wants the review, hand off to the `grimoire-review` skill
- Do NOT proceed to apply without user approval

### Agent Configuration
Check `.grimoire/config.yaml` for the configured agents:
- **Planning** uses the `thinking` agent (`llm.thinking.command` / `llm.thinking.model`) — optimized for reasoning and design
- **Implementation** uses the `coding` agent (`llm.coding.command` / `llm.coding.model`) — optimized for code generation
- If the user has configured separate thinking/coding agents, note this in the tasks.md header so the apply stage knows which agent to use

## Important
- **Specificity is the whole point.** A vague plan is worse than no plan — it gives false confidence and the LLM will re-plan anyway. Every task must be executable without thinking. "Implement the feature" is not a task — it's the *Skipping the plan / vague tasks* rationalization in `../references/red-flags.md`.
- Tasks should be substantial vertical slices with one test-code outcome.
- Every task traces back to its source artifact or approved internal outcome.
- Order matters: dependencies lead; the technical spine breaks ties between independent sections.
- Don't generate tasks for things that already work (check the baseline)
- Read the actual codebase before writing tasks. Reference real file paths, real patterns, real conventions. Don't guess.

## Done
When the user approves the tasks, the workflow is complete. Suggest next steps based on complexity:
- **Level 1**: Skip review, proceed to `grimoire-apply`
- **Level 2-3**: Optionally run `grimoire-review`, or proceed to `grimoire-apply`
- **Level 4**: `grimoire-review` is mandatory before `grimoire-apply`
