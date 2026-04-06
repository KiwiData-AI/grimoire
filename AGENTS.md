# Grimoire — AI Assistant Instructions

Grimoire is a spec-driven development workflow using **Gherkin** for behavioral requirements and **MADR** for architecture decisions. These instructions apply to any AI coding assistant.

## Engineering Principles

These principles govern all grimoire work — drafting, planning, reviewing, and implementing.

**Simple over clever.** Choose the straightforward approach. A few lines of obvious code beat an elegant abstraction. If a junior developer would need to pause and think about how it works, simplify it.

**Less code is more.** Every line is a liability — it must be read, tested, maintained, and debugged. Delete what you can. Inline what's used once. Don't write code "in case we need it later."

**Don't abstract early.** Three copies of similar code is fine. An abstraction should be extracted when a clear, stable pattern has emerged — not when you see the first hint of repetition. Wrong abstractions are harder to fix than duplicated code.

**Solve the problem in front of you.** Do not add configurability, feature flags, extension points, plugin systems, or generic interfaces unless the task specifically calls for them. Build for the current requirement, not imagined future ones.

**Use what exists.** Before writing anything, check what's already in the codebase. Use existing utilities, patterns, conventions, and libraries. Read `.grimoire/docs/` if area docs exist. A new dependency or utility needs a reason.

**Small surface area.** Fewer public functions, fewer parameters, fewer options. A function that does one thing with two parameters beats one that does three things with six parameters and a config object.

**Obvious structure.** Follow the project's existing file layout, naming conventions, and patterns. New code should look like it was written by the same team. Don't reorganize, rename, or "improve" structure that isn't part of your change.

**Errors at the boundary.** Validate user input and external data at the edges. Internal code can trust its callers — don't defensive-program against situations that can't happen.

**Verify before using.** Before importing a module, calling a function, or adding a dependency — confirm it exists. Check `.grimoire/docs/<area>.md` for reusable code with exact paths. Check `.grimoire/docs/data/schema.yml` for real model fields and API endpoints. If you haven't read the file you're importing from, read it (or its area doc) first. Never guess at package names, function signatures, or API paths.

## When to Use Grimoire

Use grimoire when the user's request involves:
- New user-facing functionality (→ Gherkin feature)
- Changes to existing behavior (→ Gherkin feature)
- Technology or architecture decisions (→ MADR decision record)
- Non-functional requirements like performance targets or security policies (→ MADR decision record)

**Do NOT use grimoire for:**
- Bug fixes — the feature file already describes correct behavior. Just fix the code.
- Pure refactoring — no behavior change means no scenario change. May warrant an ADR if architectural.
- Config changes, dependency updates, formatting — no behavioral or architectural impact.

**Routing rule:** If the request is expressible as Given/When/Then, it's a Gherkin feature. If it's a trade-off, choice, or structural decision, it's an ADR. If it's neither, it doesn't belong in grimoire.

## Decision Tree: What Do I Do?

```
User has a request
│
├─ "Something is broken / not working right"
│  → Bug fix (`/grimoire:bug`). Reproduce first: find or write a failing test,
│    then fix. If no scenario covers the behavior, add one — the bug revealed
│    a spec gap.
│
├─ "I want to add / change / remove functionality"
│  │
│  ├─ Adding new behavior?
│  │  → /grimoire:draft → write new .feature file
│  │
│  ├─ Changing existing behavior?
│  │  → /grimoire:draft → modify existing .feature file
│  │
│  ├─ Removing a feature?
│  │  → /grimoire:remove → tracked removal with impact assessment
│  │
│  └─ Does it also involve a technology/architecture choice?
│     → Draft BOTH: .feature file + MADR decision record in the same change
│
├─ "We should use X instead of Y" / "How should we architect this?"
│  → /grimoire:draft → MADR decision record (not a feature)
│
├─ "We need to handle X concurrent users / meet Y compliance"
│  → /grimoire:draft → MADR decision record (non-functional requirement)
│
├─ "What do we have? What's documented?"
│  → /grimoire:audit → discover undocumented features and decisions
│
├─ "Is everything implemented correctly?"
│  → /grimoire:verify → check code matches specs
│
├─ "Refactor / clean up / reorganize"
│  → Don't use grimoire (no behavior change). UNLESS the refactoring
│    changes module boundaries or patterns — then write an ADR.
│
└─ "Update config / deps / formatting"
   → Don't use grimoire. Just do it.
```

## Workflow: Creating or Changing a Feature

This is the end-to-end flow for the most common operation — adding or modifying behavior:

1. **User describes what they want**
2. **Draft** (`/grimoire:draft`): Qualify the request. Draft `.feature` files and/or ADRs. Write manifest. Collaborate until the user approves. Update manifest status to `approved`.
3. **Plan** (`/grimoire:plan`): Read approved artifacts. Generate `tasks.md` with red-green test pairs for each scenario. Review with user.
4. **Review** (`/grimoire:review`): *Optional.* Three-persona design review — product manager (completeness), senior engineer (simplicity and feasibility), security engineer (vulnerabilities). Fix blockers before coding.
5. **Apply** (`/grimoire:apply`): Work through tasks. For each: write test (must fail), write code (must pass), mark done. Update manifest status to `implementing`.
6. **Verify** (`/grimoire:verify`): Confirm all scenarios pass, no regressions, decisions followed. Generate report.
7. **Archive** (`grimoire archive <id>`): Sync features/decisions to baseline. Archive manifest. Update manifest status to `complete`.

Each stage has a skill. The user drives the pace. In review mode (default), every file change is approved before writing. In autonomous mode, the agent works through the full task list, stopping only on blockers.

### IMPORTANT: tasks.md Is the Plan

When `tasks.md` exists for a change, it IS the plan. **Do not enter plan mode. Do not create your own plan. Do not re-derive tasks from the feature files.**

The plan was created in the plan stage with specific file paths, specific assertions, and specific implementation details. It was reviewed and approved by the user. The apply stage executes it — nothing more.

This matters because:
- The plan was written with full codebase context (real file paths, real patterns)
- The user already approved the approach
- Re-planning wastes time and may diverge from what was agreed
- `tasks.md` supports resume — a new session should pick up where the last one left off, not start over

If a task seems wrong or impossible during apply:
1. Flag it to the user with a specific explanation
2. Wait for the user to decide: fix the task, skip it, or go back to plan
3. Do NOT silently rewrite or reorder tasks

## Directory Structure

```
project-root/
├── features/                 # Gherkin baseline — behavioral truth
│   └── <capability>/
│       └── <name>.feature
├── .grimoire/
│   ├── decisions/            # MADR baseline — architectural truth
│   │   ├── 0001-short-title.md
│   │   └── template.md
│   ├── changes/              # proposed changes (in progress)
│   │   └── <change-id>/
│   │       ├── manifest.md
│   │       ├── tasks.md
│   │       ├── features/     # proposed .feature file state
│   │       └── decisions/    # new/updated ADRs
│   └── archive/              # completed changes (manifests only)
│       └── YYYY-MM-DD-<change-id>/
│           └── manifest.md
```

## File Formats

### Gherkin Features
Standard Gherkin syntax. Every feature must have:
- A `Feature:` title with user story (As a / I want / So that)
- At least one `Scenario:` with Given/When/Then steps
- `Background:` for shared preconditions (optional)

```gherkin
Feature: Login with two-factor authentication
  As a user
  I want to verify my identity with a second factor
  So that my account is protected from unauthorized access

  Background:
    Given I am on the login page

  Scenario: Successful login with valid TOTP code
    Given I have entered valid credentials
    When I enter a valid TOTP code
    Then I should be redirected to the dashboard

  Scenario: Login rejected with expired TOTP code
    Given I have entered valid credentials
    When I enter an expired TOTP code
    Then I should see an error message "Code expired"
    And I should remain on the verification page
```

Features describe WHAT the system does, never HOW. No implementation details in feature files.

### MADR Decision Records
Follow MADR v4.0 format. File naming: `NNNN-short-title.md` (zero-padded, sequential).

```markdown
---
status: proposed
date: 2026-04-04
decision-makers: [Fred]
---

# Use PostgreSQL as Primary Database

## Context and Problem Statement
We need a relational database that supports full-text search and vector operations.

## Decision Drivers
- Must support pgvector for embeddings
- Team familiarity
- Managed hosting availability

## Considered Options
1. PostgreSQL with pgvector
2. MySQL with separate vector store
3. SQLite for development only

## Decision Outcome
Chosen option: "PostgreSQL with pgvector", because it consolidates relational and vector storage in one system the team already knows.

### Consequences
- Good: Single database to manage, strong ecosystem
- Bad: Heavier than SQLite for local dev

### Cost of Ownership
- **Maintenance burden**: Requires managed PostgreSQL hosting, pgvector extension updates, team must know PostgreSQL-specific features
- **Ongoing benefits**: Single database to operate and back up, pgvector improvements land automatically
- **Sunset criteria**: Revisit if vector query volume exceeds what pgvector handles efficiently, or if a dedicated vector store becomes necessary for latency

### Confirmation
Verify with load test that pgvector queries meet <100ms p95 target.
```

### Change Manifest
Every change in `.grimoire/changes/<change-id>/` has a `manifest.md`:

```markdown
---
status: draft
branch:
---

# Change: <Brief description>

## Why
[1-2 sentences on problem/opportunity]

## Assumptions
<!-- What must be true for this change to work? List beliefs that haven't been validated. -->
- [assumption]: [evidence or "unvalidated"]

## Pre-Mortem
<!-- Imagine this change has failed or caused a production incident 6 months from now. What went wrong? -->
- [risk]: [mitigation or "accepted"]

## Feature Changes
- **ADDED** `<capability>/<name>.feature` — [what it adds]
- **MODIFIED** `<capability>/<name>.feature` — [what changed]
- **REMOVED** `<capability>/<name>.feature` — [why removed]

## Scenarios Added
- `<file>`: "Scenario name", "Scenario name"

## Scenarios Modified
- `<file>`: "Scenario name" — [what changed]

## Decisions
- **ADDED** `NNNN-short-title.md` — [what it decides]
- **SUPERSEDED** `NNNN-short-title.md` by `NNNN-new-title.md` — [why]
```

### Tasks
Implementation checklist in `.grimoire/changes/<change-id>/tasks.md`:

```markdown
# Tasks: <change-id>

## Implementation
- [ ] 1.1 <task derived from scenario or decision>
- [ ] 1.2 <task>

## Step Definitions
- [ ] 2.1 Wire up step defs for <feature>
- [ ] 2.2 <task>

## Verification
- [ ] 3.1 Run feature files — all scenarios pass
- [ ] 3.2 Validate ADR confirmation criteria (if applicable)
```

## Three-Stage Workflow

### Stage 1: Draft
1. **Qualify the request** — behavioral? architectural? bug fix? Route accordingly.
2. **Check existing state** — read `features/` and `.grimoire/decisions/` for current baseline. Check `.grimoire/changes/` for in-progress work.
3. **Create change directory** — `.grimoire/changes/<change-id>/` (kebab-case, verb-led: `add-`, `update-`, `remove-`)
4. **Draft artifacts**:
   - Behavioral → write proposed `.feature` files in `changes/<id>/features/<capability>/`
   - Architectural → write MADR in `.grimoire/changes/<id>/decisions/`
   - Write `manifest.md` capturing intent and what changed
5. **Collaborate** — refine with the user until they approve
6. **Validate** — parse `.feature` files for syntax; check MADR frontmatter

### Stage 2: Plan
1. **Read approved artifacts** — manifest, features, decisions
2. **Generate tasks.md** — implementation checklist derived from:
   - Each new/modified scenario → implementation task
   - Each decision → implementation task(s)
   - Step definition stubs for new scenarios
3. **Traceability** — each task references the scenario or decision it implements
4. **Review with user** — confirm task order and scope

### Stage 3: Apply
1. **Read all change artifacts** — manifest, features, decisions, tasks
2. **Implement sequentially** — work through tasks in order:
   - Write production code
   - Wire up step definitions so `.feature` files become passing tests
   - Implement architectural changes from ADRs
3. **Mark progress** — update `- [ ]` to `- [x]` as tasks complete
4. **Verify** — run feature files using the project's BDD framework
5. **Finalize** — when all tasks complete:
   - Copy proposed `.feature` files to `features/` (replacing baseline)
   - Move new decisions to `.grimoire/decisions/` (with sequential numbering)
   - Archive: move manifest to `.grimoire/archive/YYYY-MM-DD-<change-id>/`

## Conventions

### Manifest Status Lifecycle
Every manifest has a `status` field in YAML frontmatter:
- `draft` — being written, not yet reviewed
- `approved` — reviewed by user, ready for planning/implementation
- `implementing` — tasks are being worked on
- `complete` — all tasks done, ready to archive

Update the status as the change progresses. The CLI reads this to report change state.

### Change IDs
- Kebab-case, verb-led: `add-two-factor-auth`, `update-login-flow`, `remove-legacy-api`
- Must be unique across active changes

### Branch Naming
Create a feature branch before implementing a change:
```
<type>/<change-id>
```
- `feat/add-two-factor-auth` — new feature
- `fix/handle-null-pricing` — bug fix
- `refactor/migrate-to-sqlalchemy` — refactoring
- `chore/update-dependencies` — maintenance

The branch name links the git history to the grimoire change. Update the manifest's `branch:` field when the branch is created.

### Commit Trailers
Every commit during a grimoire change **MUST** include a `Change:` git trailer:
```
feat(auth): add TOTP verification

Implement TOTP code verification using pyotp.

Change: add-2fa-login
Scenarios: "Login with valid TOTP code", "Login with expired TOTP code"
```

This is what makes `grimoire trace` and `grimoire log` work. Without it, the commit is invisible to the audit trail. `Scenarios:` and `Decisions:` trailers are included when relevant.

### Feature Organization
- One capability per directory: `features/auth/`, `features/documents/`
- One feature per file (or closely related features grouped)
- Tags for cross-cutting concerns: `@smoke`, `@api`, `@slow`

### Decision Numbering
- Sequential, zero-padded: `0001-`, `0002-`, etc.
- Never reuse numbers
- Superseded decisions keep their number, status updated to `superseded by NNNN`

### Step Definitions
Step definitions are organized by **domain concept**, NOT by feature file. One step file per feature file is an anti-pattern — steps should be reusable across features.

**Before writing step definitions, check the project's existing test setup.** Different projects use different BDD frameworks. Read the test configuration files, existing step definitions, and `package.json` / `requirements.txt` / `pyproject.toml` to determine which framework is in use and follow its conventions.

Common patterns by ecosystem (use as reference, not gospel — follow the project's actual conventions):

**Python (Behave):**
```
features/
├── steps/
│   ├── auth_steps.py        # steps for auth domain
│   ├── document_steps.py    # steps for document domain
│   └── common_steps.py      # shared steps
├── environment.py           # hooks and setup
```

**Python (pytest-bdd):**
```
tests/
├── conftest.py              # shared fixtures and Given steps
├── step_defs/
│   ├── test_auth.py         # steps for auth domain
│   └── test_documents.py    # steps for document domain
```

**JavaScript/TypeScript (Cucumber.js):**
```
features/
├── step_definitions/
│   ├── auth.steps.ts        # steps for auth domain
│   └── common.steps.ts      # shared steps
├── support/
│   └── world.ts             # test context/setup
```

**React / Frontend (Playwright + Cucumber or Cypress + Cucumber):**
```
e2e/
├── features/
│   └── auth/login.feature
├── steps/
│   ├── auth.steps.ts
│   └── common.steps.ts
├── pages/                   # page objects
│   └── login.page.ts
```

**Key rules:**
- NEVER create one step definition file per feature file
- Given steps are most likely to be shared — put them in a common location
- When/Then steps are more domain-specific — group by domain
- If a step is used by 2+ features, move it to the shared/common file
- Step definition bodies should be thin — delegate to helper functions, page objects, or API clients
- **Match the project's existing patterns.** If the project uses Behave, write Behave steps. If it uses Cucumber.js, write Cucumber.js steps. Don't introduce a new framework.

## Validation Checklist
Before moving past draft stage:
- [ ] Every Feature has a user story (As a / I want / So that)
- [ ] Every Scenario has at least Given + When + Then
- [ ] Feature files parse without syntax errors (validated via `@cucumber/gherkin` parser)
- [ ] MADR records have valid YAML frontmatter (status, date)
- [ ] MADR records include Cost of Ownership (maintenance burden, ongoing benefits, sunset criteria)
- [ ] Manifest lists all added/modified/removed artifacts
- [ ] Manifest includes Assumptions (what must be true, with evidence status)
- [ ] Manifest includes Pre-Mortem (failure modes and mitigations)
- [ ] No implementation details in feature files (WHAT not HOW)
