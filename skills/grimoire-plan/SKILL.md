---
name: grimoire-plan
description: Derive implementation tasks from approved Gherkin features and MADR decisions. Use when features are approved and ready for task breakdown.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-plan

Derive implementation tasks from approved Gherkin features and MADR decisions. The output must be detailed enough that any LLM can execute the tasks without further planning.

## Triggers
- User has approved a grimoire draft and wants to plan implementation
- User asks to create tasks or plan work for a grimoire change
- Loose match: "plan", "tasks" with a change reference

## Routing
- No approved change exists → `grimoire-draft` first
- Change is Level 1 (trivial) → plan is optional; suggest applying directly with minimal tasks
- User wants to review the design → `grimoire-review` (after plan, before apply)

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with:
  - `manifest.md` (approved)
  - At least one `.feature` file or decision record

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

### 1. Select Change
- List active changes in `.grimoire/changes/`
- If multiple, ask user which one to plan
- If only one, confirm it

### 2. Read All Artifacts

Read the change's artifacts following `../references/artifact-map.md` — it defines what each file is, the grimoire-docs-first / graph-for-structure discipline, and the staleness gate. Plan-specific reading on top of that:

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
Create `.grimoire/changes/<change-id>/tasks.md`. **Every task produces both production code AND a test — but the test level matches the artifact the task derives from.** Tasks are structured as pairs: the failing test first, then the production code.

**Tag every implementation task with a `verify:` level** — this tells `grimoire-apply` which test vehicle to use. Match the artifact:

| Task derives from | `verify:` | Test vehicle |
|-------------------|-----------|--------------|
| a `.feature` scenario (actor-observable behavior) | `scenario` | step definitions + Gherkin |
| a constraint in `constraints.md` (security/NFR/observability) | `unit-invariant` | unit/integration test asserting the invariant |
| an ADR consequence, refactor, or internal change with no spec | `characterization` | unit / characterization test |

**Do not plan a `.feature` scenario task for a constraint or an internal change.** Constraints get `unit-invariant` unit tests; internal changes get `characterization` tests. Forcing Gherkin onto a non-behavioral concern is the antipattern that fills feature files with slop (one right way: behavior → scenario, everything else → unit test).

**THE PLAN'S SCOPE IS WHAT WAS APPROVED.** Tasks may only derive from:
- `.feature` scenarios in this change → `verify: scenario`
- Constraints added/touched in `.grimoire/docs/constraints.md` → `verify: unit-invariant`
- ADRs in this change (and their Confirmation sections) → `verify: unit-invariant` or `characterization`
- `data.yml` entries in this change
- The manifest's Assumptions, Pre-Mortem mitigations, and Prior Art borrowings
- Verification tasks (run feature suite, run project suite, validate ADR confirmation)

Do not add tasks for scenarios you wish existed, edge cases you imagine, observability you'd like, or refactors you'd prefer. If you think one is needed, see Operating Rules §2 — propose, don't insert.

**THE PLAN MUST RESPECT NON-GOALS.** Read the manifest's Non-goals section. If a task would touch, implement, or extend something listed as a non-goal, do not include it. If you think a non-goal should be reconsidered, flag it to the user — don't silently include it.

**THE PLAN MUST BE SPECIFIC ENOUGH TO EXECUTE WITHOUT FURTHER PLANNING.** Specific means *answered*, not *delegated*: file paths resolved (not "find the right file"), reusable utilities named with exact symbol + path (not "check if one exists"), import paths verified (not "confirm the import"). See Operating Rules §1.

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
- **Which scenario it satisfies** — traceability back to the .feature file
- **What the step definition should assert** — the expected behavior, not just "write a test"

Bad task (too vague — will trigger re-planning):
```
- [ ] 1.1 Implement login with 2FA
```

Good task (specific enough to execute):
```
- [ ] 1.1 Write step defs in `tests/step_defs/test_auth.py` for scenario: "Successful login with valid TOTP code" in `auth/login.feature`
      - Given step: call `client.post('/login/', credentials)` to log in
      - When step: call `client.post('/verify-totp/', {'code': valid_code})`
      - Then step: assert response redirects to `/dashboard/` (status 302)
- [ ] 1.2 Add TOTP verification to `auth/views.py`:
      - Create `VerifyTOTPView` accepting POST with `code` field
      - Validate code against user's TOTP secret using `pyotp`
      - On success: complete login session, redirect to dashboard
      - On failure: return to verification page with error message
```

**From feature scenarios:**
- Each new scenario → step definition task + implementation task
- Each modified scenario → update step def + update implementation
- Group by capability/feature file
- Step definitions come BEFORE production code (red-green BDD cycle)
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

**From manifest Assumptions:**
- Each unvalidated assumption on the critical path → a verification task (spike, proof-of-concept, or integration test that confirms the assumption holds)
- If an assumption turns out to be wrong during planning, flag it to the user — it may invalidate the change

**From manifest Pre-Mortem:**
- Each failure mode with a mitigation → the mitigation becomes a task or an edge case to cover in an existing task
- Each failure mode marked "accepted" → add a comment in the relevant code or test noting the accepted risk, so future developers understand the trade-off
- Pre-mortem risks often reveal missing scenarios — if a failure mode isn't covered by any Gherkin scenario, consider whether it should be

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

**Verification (always last):**
- Run ALL feature files — new and existing
- Run full project test suite
- Validate ADR confirmation criteria (if applicable)

### 5. Task Format
The tasks file starts with a context block so any LLM can orient without re-reading every artifact. Each task section includes a `<!-- context: ... -->` block listing the exact files an agent should load before working on that section. This is critical for reducing context rot — each task or task group can run in a fresh session that loads only what it needs.

```markdown
# Tasks: <change-id>

> **Change**: <one-line summary from manifest>
> **Features**: <list of .feature files in this change>
> **Decisions**: <list of ADRs in this change, or "none">
> **Test command**: `<exact command to run feature tests, e.g., pytest tests/ -k "auth">`
> **Status**: X/Y tasks complete

## 1. <Capability/Area>
<!-- context:
  - features/<name>.feature
  - .grimoire/docs/<area>.md
  - src/<area>/<file-to-edit>.ts
  - tests/<area>/<test-file>.ts
-->
- [ ] 1.1 (verify: scenario) Write step defs in `<exact path>` for scenario: "<scenario name>" in `features/<file>`
      - Given: <what the step does, what it calls>
      - When: <what the step does, what it calls>
      - Then: <what to assert — specific expected values/states>
- [ ] 1.2 Implement in `<exact path>`:
      - <specific function/class/view to create or modify>
      - <specific behavior to implement>
      - <edge cases to handle>

## 2. Constraints
<!-- context:
  - .grimoire/docs/constraints.md
  - src/<area>/<file-to-edit>.ts
  - tests/<area>/<unit-test-file>.ts
-->
- [ ] 2.1 (verify: unit-invariant) Write unit test in `<exact path>` asserting constraint: "<assertion from constraints.md>"
      - Arrange: <setup>
      - Assert: <the invariant — exact expected behavior, no Gherkin>
- [ ] 2.2 Implement in `<exact path>`:
      - <specific change that satisfies the invariant>

## 3. Shared Steps
<!-- context:
  - tests/step_defs/common.py
  - features/<all relevant .feature files>
-->
- [ ] 3.1 Add to `<exact path>`:
      - Given "<step text>": <what it does>
      - Given "<step text>": <what it does>

## 4. Architecture
<!-- context:
  - .grimoire/decisions/<nnnn-title>.md
  - src/<files affected by decision>
-->
- [ ] 4.1 (verify: characterization) In `<exact path>`: <specific change from ADR>
- [ ] 4.2 Add test in `<exact path>`: <ADR confirmation check — what to assert>

## 5. Verification
- [ ] 5.1 Run `<exact test command>` — all new scenarios green
- [ ] 5.2 Run `<exact test command>` — no regressions
- [ ] 5.3 Run `<exact test command>` — full project suite
```

**Context blocks are mandatory.** Every task section (except Verification) must have a `<!-- context: ... -->` listing the files needed. This serves two purposes:
1. **Fresh sessions:** An agent starting a new session loads only the context block for its current section, avoiding accumulated noise from prior work
2. **Subagent delegation:** In Claude Code, the parent agent passes the context list when spawning a subagent for a task group

### 6. Quality Check
Before presenting to the user, verify the plan:
- [ ] Every task references a specific file path (no "implement the feature")
- [ ] Every implementation task carries a `verify:` tag matching its source artifact — `scenario` only for `.feature` behavior; `unit-invariant` for constraints; `characterization` for internal/refactor. No `.feature` scenario task for a constraint or internal change.
- [ ] Every test task describes what to assert (no "write a test")
- [ ] Every implementation task describes what to create/modify (no "add the code")
- [ ] The verification section has the exact commands to run
- [ ] Tasks are ordered: shared steps → test → production code → verification
- [ ] No task requires the LLM to make architectural decisions — those should already be in the ADR
- [ ] **Principles gate** (`../references/principles.md`): no task introduces a duplicate home for an existing fact (DRY), a second way to do an existing thing (one right way), a reinvented wheel where a tool/library/proven pattern exists (don't reinvent), or an abstraction/dependency justified only by a hypothetical (KISS). Any that does has a stated reason.

If any task is too vague, make it more specific before presenting. Read more codebase if needed.

### 7. Present to User
- Present tasks to user
- Confirm order and scope
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
- **Specificity is the whole point.** A vague plan is worse than no plan — it gives false confidence and the LLM will re-plan anyway. Every task must be executable without thinking.
- Tasks should be small and specific — one logical unit of work each
- Every task traces back to a scenario or decision
- Order matters: dependencies first, verification last
- Don't generate tasks for things that already work (check the baseline)
- Read the actual codebase before writing tasks. Reference real file paths, real patterns, real conventions. Don't guess.

## Done
When the user approves the tasks, the workflow is complete. Suggest next steps based on complexity:
- **Level 1**: Skip review, proceed to `grimoire-apply`
- **Level 2-3**: Optionally run `grimoire-review`, or proceed to `grimoire-apply`
- **Level 4**: `grimoire-review` is mandatory before `grimoire-apply`
