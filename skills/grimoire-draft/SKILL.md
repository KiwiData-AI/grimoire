---
name: grimoire-draft
description: Draft or update Gherkin features and MADR architecture decisions collaboratively with the user. Use when the user describes new functionality, requirements, or architecture choices.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-draft

Draft or update Gherkin features and MADR architecture decisions collaboratively with the user.

## Triggers
- User describes new functionality, behavior changes, or feature requests
- User asks to create/update a feature spec or requirement
- User describes a technology choice, architecture decision, or trade-off
- Loose match: contains "feature", "requirement", "spec", "decision", "grimoire" with "create", "draft", "plan", "start", "new"

## Routing
- Bug report ("something is broken") → `grimoire-bug` or `grimoire-bug-report`
- Pure refactoring (no behavior change) → no grimoire artifact needed. Suggest an ADR only if architecturally significant.
- Config, deps, formatting → not grimoire territory. Just do it.
- If unclear, apply the jurisdiction table + admission test in step 1. Do NOT default to drafting a feature — default to finding the fact's correct home, and ask one clarifying question if the test is inconclusive.

## Workflow

### 1. Qualify the Request — Jurisdiction

Before doing anything, route the change to the **one** artifact type that owns it. Each fact has exactly one home (see `../references/principles.md` — one right way, DRY). **The default is NOT "draft a feature."** The default is: figure out which home this fact belongs in.

| What the change is | Home | Not |
|--------------------|------|-----|
| **Actor-observable behavior** — an external actor does something and observes a result | `.feature` (Gherkin) | — |
| **Constraint** — security control, NFR, performance budget, observability/logging guarantee, compliance rule | `.grimoire/docs/constraints.md` (assertion + rationale + how-verified) | NOT a `.feature` |
| **Architecture decision** — a trade-off or structural choice | MADR in `.grimoire/decisions/` | NOT a `.feature` |
| **Data model / external API contract** | data schema | NOT a `.feature` |
| **Both behavior + decision** | features AND a MADR | — |
| **Bug fix** | STOP → `grimoire-bug`. "The spec already describes correct behavior; just fix the code." | — |
| **Refactoring** (no behavior change) | STOP. No artifact. Suggest an ADR only if architecturally significant. | — |
| **Config / deps / formatting** | STOP. Not grimoire territory. | — |

#### The feature-file admission test

A scenario may be written **only if it passes all four gates.** If it fails any, it is not a feature — route it to the home above.

1. **External actor** — a user, operator, or external system does the thing. "As a developer, I want structured logs" / "the system retries" → fails. The actor is internal → it's a constraint or a decision, not a feature.
2. **Observable** — the actor can see the outcome without reading code or logs. "logs are scrubbed of PII", "request completes in <200ms" → fails (not observable by an actor) → constraint.
3. **Domain language** — the scenario uses domain nouns, zero implementation detail. If a step names a library, log level, function, table, or framework (`loguru`, `INFO`, `bcrypt`, `users` table) → fails → it's leaking implementation; rewrite declaratively or move to a constraint/MADR.
4. **Survives reimplementation** — if the internals were rewritten from scratch, would the scenario still read the same? If it would change, it's pinned to implementation → not a feature.

Common slop this catches (all belong in `constraints.md`, not `.feature`): "PII is scrubbed from logs", "all endpoints require auth", "responses are gzipped", "errors are logged with a trace id". These are invariants, not behaviors.

If unclear after applying the test, ask the user one clarifying question to route correctly. **Do not guess the routing and proceed.** A wrong routing wastes both your context and the user's time — one question costs less.

### 2. Score Complexity

Assess the change's complexity to determine how much ceremony is appropriate. Score based on these signals:

| Level | Label | Signals | Ceremony |
|-------|-------|---------|----------|
| 1 | **Trivial** | Config, typo, copy change, single-file fix | Skip research (step 3). Minimal manifest (Why + Feature/Decision list only). No Pre-Mortem. |
| 2 | **Simple** | Single capability, ≤3 files, no architecture decisions, no data changes | Light research (step 3 — check built-ins and first-party only). Standard manifest. |
| 3 | **Moderate** | Multiple capabilities, architecture decisions, data model changes, new dependencies | Full research (step 3). Full manifest with Assumptions and Pre-Mortem. |
| 4 | **Complex** | Cross-cutting concerns, multiple services/systems, security-sensitive, new infrastructure | Full research (step 3). Full manifest. Mandatory `grimoire-review` after plan (not optional). |

Record the level in `manifest.md` frontmatter as `complexity: <1-4>`. Downstream skills use this:
- **Plan** adjusts task granularity (level 1-2: coarser tasks; level 3-4: fine-grained with context blocks)
- **Review** adjusts persona depth (level 1: skip review; level 2: Senior Engineer only; level 3: all relevant personas; level 4: all personas mandatory)

If unsure between two levels, pick the higher one. The user can override: "this is simpler than you think" or "treat this as complex."

### 3. Research Existing Solutions
Before designing, research what already exists. Do not ask the user to research — do it yourself.

- **Level 1**: Skip this step.
- **Level 2**: Light research — check built-ins and first-party ecosystem only.
- **Level 3-4**: Full research across all categories.

Follow the methodology in `../references/build-vs-buy.md`. Present findings to the user and wait for agreement before proceeding.

### 4.0 Design Input Check

Before interviewing, check whether design artifacts already exist for this change. If so, the interview is grounded in real components and states rather than imagined ones.

- **Existing design output**: If `.grimoire/changes/<change-id>/designs/` is already populated (a prior `grimoire-design` run produced `problem.md`, `variants.md`, `variant-{n}.html`, or `figma-snapshot.json`), read those artifacts now. Treat them as authoritative for component shape, states, and visual tokens — do not re-query Figma.
- **Figma MCP available, no design folder**: If `project.design_tool.mcp` is configured and `designs/` is absent, ask: "Figma file URL or node ID? (or skip)". On a URL or node reference, query the Figma MCP for frame data and cache the response at `.grimoire/changes/<change-id>/designs/figma-snapshot.json` per `../references/design-input-formats.md` §1 Cache. On "skip" or empty input, continue to standard elicitation.
- **No MCP and no design folder**: skip this step silently. Fall back to the standard interview elicitation in step 4 below.

When design input is consumed (either path), carry the extracted component list, states, and any token references into the elicitation in step 4 — these become concrete anchors for the questions you ask the user, replacing generic prompts.

### 4. Elicit Requirements

**Interview, don't assume.** The most common drafting failure is filling in gaps with plausible-sounding guesses. Every unstated detail is either (a) something the user has an opinion on and you must ask, or (b) something project conventions answer unambiguously. Never a third option where you invent.

Now that you know whether you're building, adopting, or going hybrid, surface the requirements the user hasn't specified.

- **Level 1**: Skip this step.
- **Level 2+**: Follow `../references/elicitation-personas.md` at the depth matching your complexity level.

The build-vs-buy outcome shapes which questions matter:
- **Adopting**: Focus on integration — how it fits, what config is needed. Skip deep business-rule elicitation.
- **Building custom**: Full elicitation — business rules, edge cases, data contracts, security, NFRs.
- **Hybrid**: Elicit deeply for custom parts. For adopted parts, focus on integration boundaries.

#### Interview protocol

1. **Outcome & Non-goals first.** Always ask these two before any persona questions — they set scope. Restate the answers back to the user before continuing.
2. **Batch questions, then wait.** Ask 3-5 questions at a time, grouped by persona. Stop. Wait for the user's reply. Do not draft scenarios until the batch is answered.
3. **Ask the question; don't pre-answer it.** "Should locked accounts get an email?" — not "I'll assume locked accounts get an email, let me know if not." The pre-answered form lets the user nod through assumptions they'd otherwise correct.
4. **One question per ambiguity, not a checklist dump.** If the user said "users can reset password", do not ask 12 generic questions. Ask the 3 that matter for *this* feature.
5. **Disambiguate immediately.** If the user's answer is vague ("yeah, handle errors gracefully"), ask the specific follow-up ("for invalid tokens, do we redirect to login with a flash message, return a 400, or something else?"). Never leave a vague answer in the spec.
6. **Capture, don't extrapolate.** If the user explicitly says "out of scope for now", note it as a non-goal and stop. Don't draft a scenario "just in case".
7. **When the user pushes back on a question** ("just write something reasonable"), record their delegation explicitly: "Defaulting to <choice> per user delegation — flag in review if wrong." This makes the assumption visible later.

#### Open-question discipline

After the interview, list every open question that wasn't answered. These become:
- **Manifest Assumptions** (level 3-4) — each open question becomes an unvalidated assumption with the reading you chose.
- **Open questions in the Requirements Summary** — explicitly listed so the user sees what you guessed.

Never silently fill in an open question. Either ask, defer to a non-goal, or record the inference.

Present a Requirements Summary (template in the reference) and wait for user confirmation before proceeding.

### 5. Check Existing State
- Read `features/` to understand the current behavioral baseline
- Read `.grimoire/decisions/` to understand existing architecture decisions
- Read `.grimoire/docs/context.yml` (if it exists) to understand the deployment environment, related services, and infrastructure — this tells you what's available (caches, queues, sibling services) and what constraints apply (deployment target, environments)
- Check `.grimoire/changes/` for any in-progress changes that might overlap
- If there's a conflict with an active change, flag it
- If `.grimoire/changes/<change-id>/consult.md` exists (from a prior `grimoire-design-consult` run), parse the `## Inferred assumptions` and `## Inferred givens` sections verbatim. Copy the contents of `## Inferred assumptions` into the manifest's Assumptions section, and copy `## Inferred givens` into a new Givens section at the same heading level (Givens applies to level 3-4 only — skip for level 1-2). The H2 headers `## Inferred assumptions` and `## Inferred givens` are load-bearing — they are the exact section names `grimoire-design-consult` writes; do not paraphrase, retitle, or fuzzy-match. Open questions from `consult.md` are NOT copied — they remain in `consult.md` as designer follow-up items.

### 6. Scaffold the Change
- Choose a `change-id`: kebab-case, verb-led (`add-`, `update-`, `remove-`)
- Ensure you're on a feature branch for this change (`grimoire-branch-guard` usually created it). The branch is where all artifacts are edited live.
- Create `.grimoire/changes/<change-id>/` — this folder holds **only ephemeral process scaffolding**: `manifest.md` (and later `tasks.md`). It does NOT hold copies of features, decisions, or constraints — those are edited live in their real locations and tracked by `git diff`. The folder is deleted at finalize; the branch + PR + git log are the durable record.

### 7. Draft Artifacts
**For behavioral changes:**

Before writing any `.feature` file, triage existing files. **The default is always extend. New files are the exception and require explicit justification.**

**Step 1 — List existing feature files (required, not skippable)**

Read `features/` recursively. Print a table before doing anything else:

```
Existing feature files:
  features/auth/login.feature         — "User Login"
  features/auth/registration.feature  — "User Registration"
  features/billing/invoices.feature   — "Invoice Management"
  ...
```

If `features/` is empty or doesn't exist, skip to step 3.

**Step 2 — Match each proposed scenario to an existing file**

For each scenario you intend to draft, explicitly decide: extend or new? Show the decision:

```
Scenario triage:
  "Admin resets a user's password"  → extend features/auth/login.feature  (same actor domain: auth)
  "User exports invoices as CSV"    → extend features/billing/invoices.feature  (same resource)
  "User configures SSO provider"    → NEW  (no existing file owns SSO configuration)
```

Do not proceed to writing until this table is complete. If unsure about a match, default to extend.

**Step 3 — Execute (edit live on the branch)**

Artifacts are edited **directly in their real locations** on the feature branch. The branch is the isolation; `git diff` is the staging area. There is no copy into `.grimoire/changes/` and no promote step (see `../references/principles.md` — don't reinvent git).

- **Extend:** add scenarios directly to the live `features/<same-relative-path>` file.
- **New file (requires justification):** state which existing files were considered and why none fit. Then create `features/<capability>/<name>.feature` directly.

Signals a scenario belongs in an existing file: same actor, same domain object, same entry point, same HTTP resource or screen.
Signals a genuinely new file: new actor type with no existing file, entirely new domain object, or existing file's Feature title would need "and" to cover both.

- Every scenario must have passed the **admission test** in step 1. If you catch yourself writing a step that names a library/log-level/table, stop — that fact belongs in `constraints.md`, not here.
- Follow Gherkin best practices:
  - Feature title + user story (As a / I want / So that)
  - Background for shared preconditions
  - One scenario per behavior
  - Given/When/Then — describe WHAT, never HOW
  - No implementation details in feature files

**When design data was provided (step 4.0):**
- If a Figma snapshot or `grimoire-design` output is available, propose Gherkin scenarios per (component × state) grounded in those artifacts. Walk the component list and the enumerated states; emit one Scenario per pair.
- Present the proposed scenarios for user review before writing to `.feature` files — accept all / accept some / edit / reject any. Rejected scenarios are not written.
- If `grimoire-design` already produced user-accepted scenarios under `.grimoire/changes/<change-id>/designs/scenarios.feature`, do NOT re-propose them; write the accepted ones live into `features/` (applying the admission test) and only fill gaps (e.g., new components not yet covered).

**Brand-tokens grounding:**
- When Figma variables map to tokens that also appear in `.grimoire/brand/tokens.json`, scenarios referencing visual properties must use token names, not hex values. Example: write `Then the submit button uses color.primary` not `Then the submit button is #0066ff`.
- Hardcoded hex values in scenarios drift silently when tokens change. Token names stay correct across re-skins.

**Component-library awareness:**
- When `.grimoire/docs/components.md` exists, prefer references to existing components by name in scenarios (e.g., `Then a Button with variant="primary" is rendered` over `Then a blue button appears`).
- Flag net-new components explicitly: emit "new component required — confirm before plan stage" alongside any scenario that introduces a component not listed in `components.md`. The plan stage will then decide whether to add it to the inventory or reuse an existing variant.

**Security tags on scenarios:**
Apply Gherkin tags per `../references/security-compliance.md` (section "Security Tags"). Tags drive stricter checks in plan, review, and verify stages. Apply compliance-specific tags only when `project.compliance` is configured. If no compliance frameworks and no security surface, don't add tags.

**For constraints (security / NFR / observability / compliance):**

Anything that failed the feature admission test because it's an invariant rather than an actor-observable behavior goes here — **not** into a `.feature`.

- Append to the live `.grimoire/docs/constraints.md` (create it from `templates/constraints.md` if absent).
- One row per constraint: **assertion · rationale · how-verified · links**. The assertion is a flat statement of what must always hold ("Log output never contains PII or secrets"), not a Given/When/Then.
- `how-verified` names the test that proves it (a `unit-invariant` test the plan stage will create) — never a Gherkin scenario.
- If the constraint stems from a decision, link the MADR; don't restate the decision (DRY).

**For architecture decisions:**
- Write the MADR record directly into the live `.grimoire/decisions/` with the next sequential number (`NNNN-title.md`)
- Use the template from `.grimoire/decisions/template.md` or the AGENTS.md format
- Include considered options, decision drivers, and consequences
- Draft status `proposed`; `grimoire-apply` flips it to `accepted` at finalize

**For changes that touch data:**
- Check `.grimoire/docs/data/schema.yml` for the current data schema (if it exists)
- If the change adds, modifies, or removes data models, fields, indexes, or external API integrations, write a `data.yml` in `.grimoire/changes/<change-id>/` showing the proposed schema changes
- Use the same YAML format as `schema.yml` but only include what's changing — new models, added/removed fields, new external API integrations
- Mark changes clearly with `action:` on each entry:

```yaml
# Proposed data changes for: add-user-profiles

users:
  action: modify
  source: src/models/user.py
  fields:
    avatar_url:                    # new field
      action: add
      type: varchar
      nullable: true
    legacy_name:                   # removing a field
      action: remove

profiles:
  action: add                      # entirely new model
  type: collection
  fields:
    user_id: { type: objectId, ref: users }
    bio: { type: string, max_length: 500 }
    social_links:
      type: array
      items:
        platform: { type: string }
        url: { type: string }

github_api:
  action: add                      # new external API dependency
  type: external_api
  provider: GitHub
  schema_ref: https://docs.github.com/en/rest
  client: src/integrations/github.py
  endpoints:
    get_user:
      method: GET
      path: /users/{username}
      request:                       # document what you send
        headers:
          Authorization: "Bearer {token}"
      response:                      # document what you expect back
        login: { type: string, required: true }
        avatar_url: { type: string, required: true }
        name: { type: string, nullable: true }
      error_response:                # document known error shapes
        message: { type: string }
        status: { type: integer }
```

**Contract documentation is mandatory for external APIs.** Every endpoint entry must include:
- **`request`**: headers, query params, or body fields your client sends
- **`response`**: fields your client reads, with types and `required: true` for fields your code depends on
- **`error_response`**: the error shape your client handles

This is the contract. Downstream skills (plan, review, verify) use it to generate contract tests and detect breaking changes. If you don't know the exact shape, reference the `schema_ref` and document what your client actually uses — that subset is the contract.

- If the change has no data impact, skip `data.yml` entirely — don't create an empty one

**For all changes:**
- Write `manifest.md` listing all artifacts, what's added/modified/removed, and why
- Include `complexity: <1-4>` in the manifest frontmatter (from step 2)
- **Level 1-2**: Assumptions and Pre-Mortem sections are optional (include if relevant)
- **Level 3-4**: Include an **Assumptions** section: list what must be true for this change to succeed. For each assumption, note whether there is evidence or it is unvalidated. Unvalidated assumptions on the critical path should be flagged to the user.
- **Level 3-4**: Include a **Pre-Mortem** section: imagine this change has failed or caused a production incident 6 months from now — what went wrong? List 2-5 plausible failure modes with mitigations or "accepted" if the risk is acknowledged.
- The manifest must include a **Prior Art** section summarizing the research from step 3: what was found, what was evaluated, and why the chosen direction (adopt, build, or hybrid) was selected. If the decision was to build, include what's being borrowed from existing implementations. This section is consumed by the plan and review stages — without it, reviewers can't validate the build-vs-buy decision.

### 8. Collaborate
- Present the draft to the user
- Iterate based on feedback
- Do NOT proceed to plan stage without user approval

### 9. Validate
- Verify `.feature` files have valid Gherkin syntax
- Verify MADR records have valid YAML frontmatter (status, date)
- Verify manifest is complete and accurate
- Every Feature has a user story
- Every Scenario has at least Given + When + Then
- No implementation details leaked into features
- **Re-run the admission test on every scenario you wrote** (step 1): external actor, observable, domain language, survives reimplementation. Any scenario that now fails is slop — move it to `constraints.md` or a MADR before proceeding.
- **Principles gate** (`../references/principles.md`): no fact written to two homes (DRY), no second way to do an existing thing (one right way), no reinvented wheel (don't reinvent), no artifact created past the stated scope (KISS).

## Important
- ONE change at a time. Don't combine unrelated changes.
- **Features describe actor-observable behavior, not implementation, and not invariants.** If a scenario has no external actor, isn't observable, or names a library/log-level/table, it is not a feature — it's a constraint (→ `constraints.md`) or a decision (→ MADR). This is the #1 source of feature-file slop.
- **One fact, one home** (`../references/principles.md`). A capability lives in one `.feature`; a control lives in one constraint row; a decision lives in one MADR. Never the same fact in two places.
- Artifacts are edited **live on the branch** — never copied into `.grimoire/changes/`. git diff is the staging area.
- The manifest is lightweight glue — don't over-document. Just enough to capture why.
- Always check if a capability/feature already exists before creating a new one.
- **Figma access token is read from `FIGMA_ACCESS_TOKEN` env var by the MCP server.** Never log the token, never write it to config, never include it in `manifest.md`, `consult.md`, `figma-snapshot.json`, or any other artifact. The MCP server handles authentication transparently — grimoire-draft never needs to see the token value.

## Done
When the user approves the draft, the workflow is complete. Present the change directory path and suggest next steps:
- `grimoire-plan` to generate implementation tasks
- Or further iteration if the user wants changes
