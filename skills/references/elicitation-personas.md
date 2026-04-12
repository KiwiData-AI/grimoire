# Elicitation Personas

Persona-driven questions to surface requirements. Used by draft (gather requirements), plan (check completeness), review (evaluate design).

## How to Use

- **In draft**: Ask these questions to gather requirements before drafting.
- **In plan**: Use as a completeness checklist — flag gaps in the specs, don't ask the user.
- **In review**: Use as evaluation criteria — check if the design addresses each concern.

## Depth by Complexity Level

| Level | Depth |
|-------|-------|
| 1 (Trivial) | Skip entirely |
| 2 (Simple) | Outcome + non-goals, then 1-3 targeted questions from the most relevant persona |
| 3 (Moderate) | Outcome + non-goals, then applicable personas in a single focused batch |
| 4 (Complex) | Outcome + non-goals, then all applicable personas in batches of 3-5, wait between batches |

Don't ask every question — only ask questions whose answers aren't already clear.

## Outcome & Scope — Always Ask First

Before diving into persona questions, establish the outcome and boundaries. These two questions prevent the most common spec failures — building the wrong thing and building too much:

- **Outcome**: What problem are you solving, and how will you know it's solved? What does the user or system look like *after* this change that's different from today?
- **Non-goals**: What is explicitly out of scope? What should this change NOT do, NOT handle, or NOT affect? Are there adjacent features, edge cases, or future plans that we should deliberately leave alone?

Record the answers. Non-goals become constraints in the manifest and guard rails during drafting — if a scenario starts creeping into a non-goal, stop and flag it.

## Product Manager — Functional Completeness

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

## Senior Engineer — Architecture & Integration

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

## Security Engineer — Security & Compliance

Ask when: the change involves authentication, authorization, user input, sensitive data, or external-facing endpoints.

- Who should have access to this? Are there roles, permissions, or ownership rules?
- Does this handle sensitive data (PII, credentials, financial, health)? Where is it stored and transmitted?
- Is there user-provided input? What's the attack surface — injection, XSS, CSRF, file upload?
- Are there compliance requirements (GDPR, HIPAA, PCI-DSS, SOC2)? Data residency or retention rules?
- Does this cross a trust boundary? Is data coming from an external system or untrusted source?

## QA Engineer — Testability & Edge Cases

Ask when: the change has complex behavior, multiple paths, or integration points.

- What are the boundary values? Min/max lengths, zero vs. one, empty collections, null states?
- What are the timing edge cases? Concurrent edits, race conditions, timeout during processing?
- What external dependencies could fail? How should the system behave when they do — retry, fallback, error?
- Is there existing behavior that could regress? What should still work exactly as before?

## Data Engineer — Data & Schema

Ask when: the change creates, modifies, or removes data models, or integrates with external APIs.

- What data entities are involved? What are the relationships between them?
- What are the field constraints? Required, unique, nullable, max length, valid ranges, enums?
- How does this data grow? Is there a retention policy, archival strategy, or cleanup needed?
- Is there existing data that needs migrating? Can the migration run live or does it need downtime?
- Are there external API contracts? What fields does the client read, and what happens if the schema changes?

## Requirements Summary Template

After elicitation, summarize what you learned in a short **Requirements Summary**. This becomes the foundation for scenarios and decisions. Format:

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
