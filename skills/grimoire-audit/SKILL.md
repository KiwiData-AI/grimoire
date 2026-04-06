# grimoire-audit

Audit an existing codebase to discover undocumented features and architecture decisions. Interview the user to collaboratively build out the grimoire baseline.

## Triggers
- User wants to onboard grimoire into an existing project
- User asks to audit, discover, or document existing behavior
- User asks "what features do we have?" or "what's not documented?"
- Loose match: "audit", "discover", "onboard", "baseline", "inventory"

## Workflow

### 1. Determine Audit Scope
Ask the user what to audit:
- **Features** — find behavioral functionality that has no `.feature` file
- **Decisions** — find implicit architecture decisions that have no ADR
- **Both** — full audit (default)

Check what's already documented:
- Read all files in `features/` for existing behavioral specs
- Read all files in `.grimoire/decisions/` for existing ADRs
- This is your "already known" set — don't re-propose these

### 2. Feature Discovery
Scan the codebase for behavioral functionality. Look at:
- **Routes / URL patterns** — each route implies user-facing behavior
- **Views / Controllers** — what actions can users take?
- **API endpoints** — what does the system expose?
- **UI components / templates** — what do users see and interact with?
- **Background tasks / jobs** — what happens automatically?
- **Permissions / auth** — what access control exists?
- **Email / notifications** — what does the system communicate?

For each discovered behavior cluster, check if a corresponding `.feature` file exists. If not, note it as undocumented.

### 3. Decision Discovery
Scan for implicit architecture decisions:
- **Dependencies** — what major libraries/frameworks are used and why? (requirements.txt, package.json, go.mod)
- **Database** — what database(s), why, any extensions?
- **Infrastructure patterns** — caching, queuing, search, file storage
- **Auth patterns** — how is authentication/authorization implemented?
- **API design** — REST? GraphQL? RPC? What conventions?
- **Testing patterns** — what framework, what strategy?
- **Deployment** — Docker, K8s, serverless? CI/CD pipeline?
- **Data model** — multi-tenant? event-sourced? CQRS?

For each pattern found, check if a corresponding ADR exists. If not, note it as undocumented.

### 4. Interview the User
Do NOT dump a massive list. Present findings in batches of 3-5, grouped by area, and ask the user about each:

For features:
> "I found a document review workflow with routes for `/dais/review/document/<id>/`. There's tab switching, error modals, and tag editing. I don't see a feature file covering this. Should I draft one?"

For decisions:
> "You're using PostgreSQL with pgvector for embeddings and Redis with Huey for task queuing. These seem like deliberate choices but I don't see ADRs for them. Want me to capture these?"

Let the user:
- **Confirm** — yes, draft it
- **Skip** — not important enough to document
- **Clarify** — provide context the code doesn't show
- **Group** — "those three things are actually one feature"

### 5. Draft Artifacts
For confirmed items, create a grimoire change:
- Change ID: `audit-<area>` (e.g., `audit-auth`, `audit-data-model`)
- Draft `.feature` files for confirmed behavioral specs
- Draft MADR records for confirmed decisions
- Write manifest summarizing what was discovered and documented

Group related items into single changes — don't create one change per discovery.

### 6. Dead Feature Detection
Check for documented features and decisions that may no longer be accurate:

**Dead features** — feature files that describe behavior the code no longer implements:
- Feature files with no corresponding step definitions
- Step definitions that reference modules, classes, or functions that no longer exist
- Step definitions with `pass`, `NotImplementedError`, or empty bodies
- Features tagged `@skip` or `@wip` indefinitely
- Features whose routes/endpoints/views have been deleted

**Stale decisions** — ADRs that describe choices no longer reflected in the code:
- ADR says "use library X" but library X is no longer in dependencies
- ADR is `accepted` but the pattern it describes isn't in the codebase
- ADR references files or modules that no longer exist

Present dead features and stale decisions to the user with the same interview approach — batches of 3-5:
> "I found `features/billing/invoice.feature` with 4 scenarios, but there are no step definitions and the `InvoiceView` it would test was deleted 3 months ago. Should I create a removal change for this?"

Options for the user:
- **Remove** — create a grimoire removal change to clean it up
- **Revive** — the feature should exist; create a change to re-implement it
- **Update** — the feature exists but the spec is outdated; create a change to fix the spec
- **Skip** — leave it for now

### 7. Prioritize
After the interview, summarize:
- How many features are documented vs. undocumented
- How many features are dead or stale
- How many decisions are documented vs. undocumented
- How many decisions are stale
- Suggest which areas to address first (highest risk / most complex / most frequently changed)

## Important
- This is a COLLABORATIVE process, not a dump. Interview, don't lecture.
- Present findings in small batches. Let the user guide priority.
- The user knows things the code doesn't show — ask about intent, not just structure.
- Some things legitimately don't need documentation. Respect "skip" answers.
- Don't try to document everything in one session. It's ok to do multiple audit passes.
- Features should describe WHAT the system does, not HOW the code works. Don't just translate code into Gherkin.
- For decisions, focus on choices that were non-obvious or have alternatives. "We use Python" doesn't need an ADR. "We use Huey instead of Celery" probably does.
