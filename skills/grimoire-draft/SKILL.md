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

### 2. Research Existing Solutions
Before designing anything, **you must actively research** what already exists. Do not ask the user to research — do it yourself and present findings. This applies to both behavioral features and architectural decisions.

#### 2a. Conduct the Research
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

#### 2b. Evaluate Build vs Buy/Import
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

#### 2c. If Building: Learn from What Exists
When the decision is to build custom code, **study existing implementations before designing**:

- **Document the prior art**: For each relevant existing tool, note its architecture, data flows, API design, and key abstractions. What patterns does it use? What did its maintainers learn over time (check changelogs, migration guides, design docs)?
- **Identify what's different**: Be precise about why the project's needs diverge. "We need something different" is not enough — state the specific requirements that existing tools don't meet.
- **Borrow deliberately**: List specific design patterns, data flow approaches, API shapes, or architectural decisions from existing tools that should inform the custom implementation. This prevents reinventing what others have already refined.
- **Scope the custom work**: Define the minimum viable version. If an existing tool does 10 things and you only need 3, build those 3. Don't replicate the full feature set.

#### 2d. Present Findings to User
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

### 3. Check Existing State
- Read `features/` to understand the current behavioral baseline
- Read `.grimoire/decisions/` to understand existing architecture decisions
- Read `.grimoire/docs/context.yml` (if it exists) to understand the deployment environment, related services, and infrastructure — this tells you what's available (caches, queues, sibling services) and what constraints apply (deployment target, environments)
- Check `.grimoire/changes/` for any in-progress changes that might overlap
- If there's a conflict with an active change, flag it

### 4. Scaffold the Change
- Choose a `change-id`: kebab-case, verb-led (`add-`, `update-`, `remove-`)
- Create `.grimoire/changes/<change-id>/`

### 5. Draft Artifacts
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
- Include an **Assumptions** section: list what must be true for this change to succeed. For each assumption, note whether there is evidence or it is unvalidated. Unvalidated assumptions on the critical path should be flagged to the user.
- Include a **Pre-Mortem** section: imagine this change has failed or caused a production incident 6 months from now — what went wrong? List 2-5 plausible failure modes with mitigations or "accepted" if the risk is acknowledged.
- The manifest must include a **Prior Art** section summarizing the research from step 2: what was found, what was evaluated, and why the chosen direction (adopt, build, or hybrid) was selected. If the decision was to build, include what's being borrowed from existing implementations. This section is consumed by the plan and review stages — without it, reviewers can't validate the build-vs-buy decision.

### 6. Collaborate
- Present the draft to the user
- Iterate based on feedback
- Do NOT proceed to plan stage without user approval

### 7. Validate
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
