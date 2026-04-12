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

## Workflow

### 1. Qualify the Request
Before doing anything, determine what kind of change this is:

- **Behavioral** (Given/When/Then expressible) → draft `.feature` files
- **Architectural** (trade-off, choice, structural) → draft MADR decision record
- **Both** → draft features AND decision records
- **Bug fix** → STOP. Tell the user: "The feature file already describes the correct behavior. Let's just fix the code."
- **Refactoring** → STOP. No behavior change = no grimoire artifact. Suggest an ADR only if it's a significant architectural shift.
- **Config/deps/formatting** → STOP. Not grimoire territory.

If unclear, ask the user one clarifying question to route correctly.

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
Before designing anything, **you must actively research** what already exists. Do not ask the user to research — do it yourself and present findings. This applies to both behavioral features and architectural decisions.

#### 3a. Conduct the Research
Search for existing solutions across these categories (skip categories that clearly don't apply):

- **Language/framework built-ins**: Does the framework already have this? (e.g., Django has auth, React has context, Express has middleware). Check official docs.
- **First-party ecosystem**: Official plugins, extensions, or companion packages from the framework maintainers.
- **Popular libraries**: Search the relevant package registry (npm, PyPI, crates.io, etc.) for well-maintained packages. Use web search to find comparison articles, "best of" lists, and Stack Overflow recommendations.
- **Open-source projects**: GitHub repos that solve the same problem as a standalone tool or reference implementation.
- **SaaS/managed services**: Hosted solutions that handle the problem as a service (e.g., Auth0 for auth, Stripe for payments, Algolia for search).

For each candidate found, gather:
- **Name and link** to docs/repo
- **Maintenance signals**: last release date, commit frequency, open issues, download count
- **Fit**: does it match the project's language, framework, and deployment constraints?
- **Scope match**: does it solve 100% of the need, 80%, or just a part?
- **Trade-offs**: what design decisions does it impose? What would the project give up by adopting it?

#### 3b. Evaluate Build vs Buy/Import
Apply this decision framework:

| Signal | Points toward **adopt** | Points toward **build** |
|--------|------------------------|------------------------|
| Scope match | Solves ≥80% of the need | Solves <50% or forces unwanted constraints |
| Maintenance | Active, >1 maintainer, regular releases | Abandoned, single maintainer, or unmaintained fork |
| Integration cost | Drop-in or <1 day to integrate | Requires significant adapter code or workarounds |
| Customization | Configurable or extensible where needed | Core behavior can't be changed without forking |
| Dependencies | Few, well-known transitive deps | Heavy dependency tree or conflicts with project deps |
| Security | Audited, follows best practices, no known CVEs | Unaudited, handles sensitive data unsafely |
| Licensing | Compatible with project license | Incompatible or ambiguous license |
| Project constraints | Fits deployment target, bundle size, performance needs | Doesn't fit runtime environment or adds unacceptable overhead |

When the decision is close, **prefer adopting** — maintaining custom code is almost always more expensive than people expect.

#### 3c. If Building: Learn from What Exists
When the decision is to build custom code, **study existing implementations before designing**:

- **Document the prior art**: For each relevant existing tool, note its architecture, data flows, API design, and key abstractions. What patterns does it use? What did its maintainers learn over time (check changelogs, migration guides, design docs)?
- **Identify what's different**: Be precise about why the project's needs diverge. "We need something different" is not enough — state the specific requirements that existing tools don't meet.
- **Borrow deliberately**: List specific design patterns, data flow approaches, API shapes, or architectural decisions from existing tools that should inform the custom implementation. This prevents reinventing what others have already refined.
- **Scope the custom work**: Define the minimum viable version. If an existing tool does 10 things and you only need 3, build those 3. Don't replicate the full feature set.

#### 3d. Present Findings to User
Present a structured summary **before drafting any artifacts**:

```markdown
## Prior Art Research

### Existing Solutions Found
1. **[name]** — [one-line description]. [fit assessment]. [key trade-off].
2. **[name]** — ...

### Recommendation
- **Adopt [name]** because [reasons] → draft becomes an ADR documenting the adoption
- OR **Build custom** because [specific gaps: requirement X isn't met by any option, constraint Y rules out adoption]. Borrowing [patterns/flows] from [existing tool].
- OR **Hybrid**: adopt [name] for [scope] and build custom [scope] because [reasons]

### If Building: What Makes This Different
- [Requirement that no existing tool meets]
- [Constraint that rules out adoption]
- [Design decision that must differ from prior art, and why]

### If Building: Borrowed from Prior Art
- [Pattern/flow/API shape] from [tool] — because [reason it's proven]
```

Wait for user agreement on the direction before proceeding to draft artifacts. If the user hasn't done this research and has a strong opinion, present the findings anyway — they may not be aware of the options.

### 4. Elicit Requirements

Now that you know whether you're building, adopting, or going hybrid, use persona-driven questions to surface the requirements the user hasn't specified. The build-vs-buy outcome shapes which questions matter:

- **Adopting**: Focus on integration requirements — how it fits the project, what configuration is needed, what the project's specific constraints are. Skip deep business-rule elicitation (the library defines the behavior).
- **Building custom**: Full elicitation — business rules, edge cases, data contracts, security, NFRs. You're defining the behavior from scratch.
- **Hybrid**: Elicit deeply for the custom-built parts. For adopted parts, focus on integration boundaries and where custom code meets the library.

**Don't ask every question** — read the user's request and the research findings, identify which categories are relevant, and ask only the questions whose answers aren't already clear.

**Level 1**: Skip this step entirely.
**Level 2**: Ask outcome + non-goals, then 1-3 targeted questions from the most relevant persona.
**Level 3**: Ask outcome + non-goals, then work through applicable personas. Ask questions in a single focused batch, wait for answers.
**Level 4**: Ask outcome + non-goals, then work through all applicable personas. Ask in batches of 3-5, wait for answers, then ask follow-ups. Stop when you have enough to draft — don't interrogate.

#### Outcome & Scope — Always Ask First
Before diving into persona questions, establish the outcome and boundaries. These two questions prevent the most common spec failures — building the wrong thing and building too much:

- **Outcome**: What problem are you solving, and how will you know it's solved? What does the user or system look like *after* this change that's different from today?
- **Non-goals**: What is explicitly out of scope? What should this change NOT do, NOT handle, or NOT affect? Are there adjacent features, edge cases, or future plans that we should deliberately leave alone?

Record the answers. Non-goals become constraints in the manifest and guard rails during drafting — if a scenario starts creeping into a non-goal, stop and flag it.

#### Product Manager — Functional Completeness
Ask when: the change has user-facing behavior.

- Who are the actors? Is there more than one user role involved? Do they see/do different things?
- What triggers this — user action, scheduled job, external event, or another system?
- What does success look like from the user's perspective? What do they see/receive?
- What are the business rules? Validation constraints, conditional logic, calculations, limits?
- What happens when the user makes a mistake? Invalid input, wrong state, missing data?
- Are there state transitions? What states can this entity be in, and what moves it between them?
- Is there a UI component? What does each state look like — loading, empty, error, success, partial?
- *(If UI)* Do you have designs or mockups? Check `.grimoire/config.yaml` under `project.design_tool` for where designs live. Ask the user to point to the specific screen/flow — reference it in the requirements summary so downstream skills can consult it.
- Does this interact with existing features? Could it conflict with or depend on other workflows?
- Does this need to support multiple languages or locales? If so, which ones?
- What accessibility standard applies? (WCAG 2.1 AA is the most common default. If the project has no standard, ask.)

#### Senior Engineer — Architecture & Integration
Ask when: the change introduces new components, services, dependencies, or data flows.

- What's the deployment context? Does this run in the same service or cross service boundaries?
- What existing components does this touch? Are there shared modules, APIs, or databases involved?
- Are there concurrency concerns? Multiple users or processes acting on the same data?
- What's the data flow? Where does data enter, how is it transformed, where does it end up?
- Are there ordering or idempotency requirements? What happens if this runs twice?
- Does this need to be backwards-compatible with existing clients, APIs, or data formats?
- Is there a rollout concern? Can this be deployed incrementally, or is it all-or-nothing? Feature flag needed?
- What are the performance expectations? Response time target, expected throughput, data volume at scale?
- How will you observe this in production? What metrics, logs, or alerts should exist? What does "healthy" look like on a dashboard?
- What's the availability target? What happens during partial outages — degrade gracefully or fail fast?
- *(If adopting)* What customization or configuration does the library need for this project's constraints?
- *(If adopting)* Where does the library's responsibility end and custom code begin?

#### Security Engineer — Security & Compliance
Ask when: the change involves authentication, authorization, user input, sensitive data, or external-facing endpoints.

- Who should have access to this? Are there roles, permissions, or ownership rules?
- Does this handle sensitive data (PII, credentials, financial, health)? Where is it stored and transmitted?
- Is there user-provided input? What's the attack surface — injection, XSS, CSRF, file upload?
- Are there compliance requirements (GDPR, HIPAA, PCI-DSS, SOC2)? Data residency or retention rules?
- Does this cross a trust boundary? Is data coming from an external system or untrusted source?

#### QA Engineer — Testability & Edge Cases
Ask when: the change has complex behavior, multiple paths, or integration points.

- What are the boundary values? Min/max lengths, zero vs. one, empty collections, null states?
- What are the timing edge cases? Concurrent edits, race conditions, timeout during processing?
- What external dependencies could fail? How should the system behave when they do — retry, fallback, error?
- Is there existing behavior that could regress? What should still work exactly as before?

#### Data Engineer — Data & Schema
Ask when: the change creates, modifies, or removes data models, or integrates with external APIs.

- What data entities are involved? What are the relationships between them?
- What are the field constraints? Required, unique, nullable, max length, valid ranges, enums?
- How does this data grow? Is there a retention policy, archival strategy, or cleanup needed?
- Is there existing data that needs migrating? Can the migration run live or does it need downtime?
- Are there external API contracts? What fields does the client read, and what happens if the schema changes?

#### After Elicitation
Summarize what you learned in a short **Requirements Summary**. This becomes the foundation for scenarios and decisions. Format:

```markdown
## Requirements Summary

**Outcome**: [what problem this solves, how we'll know it's solved]
**Non-goals**: [what's explicitly out of scope — won't do, won't handle, won't affect]
**Actors**: [who]
**Trigger**: [what starts this]
**Happy path**: [what success looks like]
**Business rules**: [validation, constraints, logic]
**Error cases**: [what can go wrong]
**Data**: [what's created/modified, key constraints]
**Security**: [access control, sensitive data, compliance]
**Performance**: [response time, throughput, data volume targets — if applicable]
**Observability**: [key metrics, alerts, what "healthy" looks like — if applicable]
**Availability**: [uptime target, degradation strategy — if applicable]
**Accessibility**: [WCAG level, requirements — if applicable]
**i18n**: [supported locales — if applicable]
**Design reference**: [link to mockup/design, or "none" — if UI change]
**Open questions**: [anything the user couldn't answer yet — flag as unvalidated assumptions]
```

Wait for user confirmation of the summary before proceeding to draft.

### 5. Check Existing State
- Read `features/` to understand the current behavioral baseline
- Read `.grimoire/decisions/` to understand existing architecture decisions
- Read `.grimoire/docs/context.yml` (if it exists) to understand the deployment environment, related services, and infrastructure — this tells you what's available (caches, queues, sibling services) and what constraints apply (deployment target, environments)
- Check `.grimoire/changes/` for any in-progress changes that might overlap
- If there's a conflict with an active change, flag it

### 6. Scaffold the Change
- Choose a `change-id`: kebab-case, verb-led (`add-`, `update-`, `remove-`)
- Create `.grimoire/changes/<change-id>/`

### 7. Draft Artifacts
**For behavioral changes:**
- Write proposed `.feature` files in `.grimoire/changes/<change-id>/features/<capability>/`
- If modifying an existing feature, copy the current baseline first, then modify
- Follow Gherkin best practices:
  - Feature title + user story (As a / I want / So that)
  - Background for shared preconditions
  - One scenario per behavior
  - Given/When/Then — describe WHAT, never HOW
  - No implementation details in feature files

**Security tags on scenarios:**
Apply Gherkin tags per `../references/security-compliance.md` (section "Security Tags"). Tags drive stricter checks in plan, review, and verify stages. Apply compliance-specific tags only when `project.compliance` is configured. If no compliance frameworks and no security surface, don't add tags.

**For architecture decisions:**
- Write MADR record in `.grimoire/changes/<change-id>/decisions/`
- Use the template from `.grimoire/decisions/template.md` or the AGENTS.md format
- Include considered options, decision drivers, and consequences

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

## Important
- ONE change at a time. Don't combine unrelated changes.
- Features describe behavior, not implementation. If you catch yourself writing step-level implementation details, you've gone too far.
- The manifest is lightweight glue — don't over-document. Just enough to capture why.
- Always check if a capability/feature already exists before creating a new one.
