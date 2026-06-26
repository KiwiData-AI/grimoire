---
name: grimoire-audit
description: Audit an existing codebase to discover undocumented features and architecture decisions. Use when onboarding an existing project to grimoire.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-audit

Audit an existing codebase to discover undocumented features and architecture decisions. Interview the user to collaboratively build out the grimoire baseline.

## Triggers
- User wants to onboard grimoire into an existing project
- User asks to audit, discover, or document existing behavior
- User asks "what features do we have?" or "what's not documented?"
- Loose match: "audit", "discover", "onboard", "baseline", "inventory"

## Routing
- Want to map codebase structure, utilities, and patterns → `grimoire-discover` first
- Want to add new functionality → `grimoire-draft`
- Want to find code quality issues → `grimoire-refactor`

## Workflow

### 1. Determine Audit Scope
Ask the user what to audit:
- **Features** — find behavioral functionality that has no `.feature` file
- **Decisions** — find implicit architecture decisions that have no ADR
- **Conventions** — find conventions files in `.grimoire/docs/conventions/` whose placement/naming rules no longer match the codebase
- **Both** / **All** — full audit (default: features + decisions + conventions)

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

For each pattern found, check if a corresponding ADR exists. If not, apply the **novelty gate** before proposing one:

- **Only propose an ADR for a novel decision** — one with a real, project-specific trade-off between viable alternatives. An industry-default pick on this stack (the standard test runner, CLI parser, git wrapper, linter; the ecosystem-forced module convention) is **not** novel. Test: *would a competent engineer on this stack pick differently, and need the reasoning to understand the choice?* If no, do not backfill an ADR for it.
- **Do NOT mint one ADR per default tooling pick.** That is the most common audit-backfill failure — it floods the register with "we used the standard tool" records. Collect the obvious tooling/convention defaults into a single `Tooling and convention baseline` ADR (one row each: choice → why), and reserve sequential ADRs for genuine trade-offs (e.g. "Huey instead of Celery", "regex over tree-sitter").

### 3.5. Conventions Drift Detection
Read each file in `.grimoire/docs/conventions/`. For each file:
1. Use MCP `get_architecture` or `search_graph` to query the current code structure for the relevant area
2. Compare the conventions file's placement rules, naming rules, and patterns against what MCP reports the codebase actually does
3. Flag any conventions rule that no longer matches:
   - "api.md says new views go in `src/api/views/` but MCP shows views now in `src/api/handlers/`"
   - "models.md says models are prefixed with `I` but no `I`-prefixed models found in MCP graph"

Present drifted conventions to the user with the same batched interview approach:
> "api.md states that new views go in `src/api/views/`, but the codebase now places them in `src/api/handlers/`. Options:
> - **refresh** — update the conventions file to match current code (I'll open it for editing with MCP-sourced state)
> - **accept-as-is** — the conventions file is intentionally ahead of the code
> - **skip** — leave for now"

Skip this step when the user's scope answer was "features only" or "decisions only".

### 4. Interview the User
Do NOT dump a massive list. Present findings in batches of 3-5, grouped by area, and ask the user about each:

Clearly label each batch item as one of: "undocumented feature", "undocumented decision", or "drifted convention"

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

**Detection is deterministic.** Every dead/stale finding cites exact `file:line` (or ADR id) evidence from a reproducible check — codebase-memory-mcp graph queries (`search_graph` / `get_architecture`) per [0029]/[0030], with `grep` / `git blame` only where the graph has no answer (e.g. `@skip` age). The same commit yields the same findings. The LLM summarizes and interviews; it does not score the codebase by impression.

Check for documented features and decisions that may no longer be accurate:

**Dead features** — feature files that describe behavior the code no longer implements:
- Feature files with no step definitions: for each `.feature` file, grep the test directory for its step text patterns
- Orphaned step definitions: grep step definition imports, check if referenced modules still exist on disk
- Stub step definitions: `grep -rn 'pass$\|NotImplementedError\|\.\.\.$$' <test-dir>` (empty bodies)
- Stale skips: `grep -rn '@skip\|@wip' features/` cross-referenced with `git blame` for age
- Deleted routes: for each feature's endpoint, grep the codebase for the route — missing = dead

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
- How many conventions files drifted vs. up-to-date

Then emit a **Top Actions** list — most-risk first, each with the exact path and the single next move. The ranking comes from the deterministic checks (§6), not impression, so the same commit yields the same list:

```markdown
## Top Actions
1. `features/billing/invoice.feature` — dead (InvoiceView deleted ~3mo ago); create a removal change.
2. `.grimoire/decisions/0007-search-backend.md` — stale (library no longer in deps); deprecate or update.
3. `.grimoire/docs/conventions/api.md` — drifted (views moved to `src/api/handlers/`); refresh.
```

## Important
- This is a COLLABORATIVE process, not a dump. Interview, don't lecture.
- Present findings in small batches. Let the user guide priority.
- The user knows things the code doesn't show — ask about intent, not just structure.
- Some things legitimately don't need documentation. Respect "skip" answers.
- Don't try to document everything in one session. It's ok to do multiple audit passes.
- Features should describe WHAT the system does, not HOW the code works. Don't just translate code into Gherkin.
- For decisions, focus on choices that were non-obvious or have alternatives. "We use Python" doesn't need an ADR. "We use Huey instead of Celery" probably does.

## Done
When the audit interview is complete and confirmed items are drafted as grimoire changes, the workflow is complete. Suggest next steps: `grimoire-plan` for approved changes, or another audit pass for uncovered areas.
