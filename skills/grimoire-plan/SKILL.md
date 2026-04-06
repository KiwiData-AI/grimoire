# grimoire-plan

Derive implementation tasks from approved Gherkin features and MADR decisions. The output must be detailed enough that any LLM can execute the tasks without further planning.

## Triggers
- User has approved a grimoire draft and wants to plan implementation
- User asks to create tasks or plan work for a grimoire change
- Loose match: "plan", "tasks" with a change reference

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with:
  - `manifest.md` (approved)
  - At least one `.feature` file or decision record

## Workflow

### 1. Select Change
- List active changes in `.grimoire/changes/`
- If multiple, ask user which one to plan
- If only one, confirm it

### 2. Read All Artifacts

**Grimoire docs first, codebase second.** The `.grimoire/docs/` directory is a pre-computed map of the codebase — it tells you where code lives, what utilities exist, what patterns to follow, and what the data layer looks like. Read these *instead of* exploring the raw codebase. Only read specific source files when the docs don't have what you need.

**Always read:**
- `manifest.md` for the change summary, **including Assumptions and Pre-Mortem sections**
- All proposed `.feature` files
- All proposed decision records, **including Cost of Ownership sections**
- The current baseline (`features/`, `.grimoire/decisions/`) for context on what's changing

**Read from grimoire docs (these replace codebase exploration):**
- **`.grimoire/docs/<area>.md`** for each area the change touches — these contain: key files with responsibilities, reusable utilities (exact function names, file paths, line numbers), naming conventions, structural patterns, and "Where New Code Goes" guidance. This is the information that lets you write tasks with exact file paths without reading every source file.
- **`.grimoire/docs/data/schema.yml`** — the full data model: every table/collection, field types, relationships, indexes, and external API contracts with `source:` pointers to ORM code. Read this instead of reading individual model files.
- **`.grimoire/docs/context.yml`** — the project's deployment environment, related services, infrastructure dependencies, CI/CD pipelines, and observability setup. Read this to understand deployment constraints (e.g., Lambda means no long-running processes, Kubernetes means you may need health check endpoints), cross-service boundaries (e.g., auth is handled by a sibling service, not this project), and infrastructure available at runtime (e.g., Redis is available for caching, RabbitMQ for async tasks).
- **`.grimoire/docs/.snapshot.json`** `duplicates` section if present — existing clones in areas you're touching, so tasks consolidate rather than add more.

**Read proposed data changes:**
- **`data.yml`** if present — proposed schema changes need migration and model tasks

**Read specific source files only when:**
- Area docs don't exist yet (tell the user to run `grimoire map` + `/grimoire:discover` first — planning without area docs produces worse tasks)
- Area docs exist but you need to verify a specific implementation detail (e.g., exact function signature, exact import path)
- You need to read existing step definitions to understand the test setup

**Do NOT read the entire codebase** for "context." The plan skill's job is to produce tasks with specific file paths and specific assertions. Area docs + data schema give you this. Reading dozens of source files wastes context window and doesn't produce better plans.

### 3. Generate Tasks
Create `.grimoire/changes/<change-id>/tasks.md`. **Every scenario must produce both production code AND tests.** Tasks are structured as pairs: step definitions first, then production code.

**THE PLAN MUST BE SPECIFIC ENOUGH TO EXECUTE WITHOUT FURTHER PLANNING.**

**THE PLAN MUST PREFER SIMPLICITY.** For each task, choose the approach with the least code, fewest new files, and smallest surface area. If a task can be solved by adding a few lines to an existing file, don't create a new module. If a standard library function does the job, don't pull in a dependency. If three lines of inline code are clearer than a helper, keep them inline. Flag any task that introduces a new abstraction, utility, or pattern — it needs a reason.

**THE PLAN MUST USE PROVEN PATTERNS, NOT INVENT NEW ONES.** When the task fits a well-known pattern, name it and follow it:
- **Data pipelines** → ETL (Extract, Transform, Load) or ELT. Name stages explicitly. Don't invent a bespoke "data flow."
- **Web applications** → MVC, MVP, or MVVM depending on the framework's conventions. Follow the framework, don't fight it.
- **APIs** → RESTful resource design, or the project's existing API style. Don't mix conventions.
- **Background jobs** → Producer/consumer, pub/sub, or the framework's job/task pattern (e.g., Celery tasks, Bull queues).
- **State management** → Use the framework's idiomatic approach (Redux, Vuex, signals, etc.), not a hand-rolled event system.
- **Authentication & security** → Always recommend proven security processes: OAuth2/OIDC for auth flows, bcrypt/argon2 for password hashing, CSRF protection for forms, parameterized queries for database access. Never roll custom crypto, custom auth tokens, or custom session management when a battle-tested library exists.

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
- Data tasks come BEFORE feature implementation tasks — the models must exist before code that uses them
- Order: schema/model changes → migrations → seed data (if any) → then feature code

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

**Existing code to reuse:**
- If `.grimoire/docs/` has area docs, check the Reusable Code tables for utilities that apply to this change
- If the snapshot has duplicate data, check whether the area you're touching already has clones — tasks should consolidate rather than add more
- Add a "Reuse" section at the top of tasks.md listing specific functions/classes to import instead of rewriting

**Verification (always last):**
- Run ALL feature files — new and existing
- Run full project test suite
- Validate ADR confirmation criteria (if applicable)

### 4. Task Format
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
  - .grimoire/changes/<change-id>/features/<capability>/<name>.feature
  - .grimoire/docs/<area>.md
  - src/<area>/<file-to-edit>.ts
  - tests/<area>/<test-file>.ts
-->
- [ ] 1.1 Write step defs in `<exact path>` for scenario: "<scenario name>" in `<file>`
      - Given: <what the step does, what it calls>
      - When: <what the step does, what it calls>
      - Then: <what to assert — specific expected values/states>
- [ ] 1.2 Implement in `<exact path>`:
      - <specific function/class/view to create or modify>
      - <specific behavior to implement>
      - <edge cases to handle>
- [ ] 1.3 Write step defs in `<exact path>` for scenario: "<next scenario>"
      ...
- [ ] 1.4 Implement in `<exact path>`:
      ...

## 2. Shared Steps
<!-- context:
  - tests/step_defs/common.py
  - .grimoire/changes/<change-id>/features/<all relevant .feature files>
-->
- [ ] 2.1 Add to `<exact path>`:
      - Given "<step text>": <what it does>
      - Given "<step text>": <what it does>

## 3. Architecture
<!-- context:
  - .grimoire/changes/<change-id>/decisions/<nnnn-title>.md
  - src/<files affected by decision>
-->
- [ ] 3.1 In `<exact path>`: <specific change from ADR>
- [ ] 3.2 Add test in `<exact path>`: <ADR confirmation check — what to assert>

## 4. Verification
- [ ] 4.1 Run `<exact test command>` — all new scenarios green
- [ ] 4.2 Run `<exact test command>` — no regressions
- [ ] 4.3 Run `<exact test command>` — full project suite
```

**Context blocks are mandatory.** Every task section (except Verification) must have a `<!-- context: ... -->` listing the files needed. This serves two purposes:
1. **Fresh sessions:** An agent starting a new session loads only the context block for its current section, avoiding accumulated noise from prior work
2. **Subagent delegation:** In Claude Code, the parent agent passes the context list when spawning a subagent for a task group

### 5. Quality Check
Before presenting to the user, verify the plan:
- [ ] Every task references a specific file path (no "implement the feature")
- [ ] Every step definition task describes what to assert (no "write a test")
- [ ] Every implementation task describes what to create/modify (no "add the code")
- [ ] The verification section has the exact commands to run
- [ ] Tasks are ordered: shared steps → step defs → production code → verification
- [ ] No task requires the LLM to make architectural decisions — those should already be in the ADR

If any task is too vague, make it more specific before presenting. Read more codebase if needed.

### 6. Present to User
- Present tasks to user
- Confirm order and scope
- Adjust based on feedback

### 7. Design Review
- Once the user approves the tasks, suggest running `grimoire-review` for a multi-perspective design review (product manager, senior engineer, security engineer)
- This step is **optional** — the user can skip it and go straight to `grimoire-apply`
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
