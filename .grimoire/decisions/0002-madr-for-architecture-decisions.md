---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Use MADR for architecture decision records

## Context and Problem Statement
Gherkin handles behavioral requirements well but is intentionally bad at non-functional requirements, architecture decisions, and technical trade-offs. These don't fit Given/When/Then. Without capturing them, AI agents re-litigate architecture choices.

## Decision Drivers
- Architecture decisions must be documented so AI agents don't override them
- Format should have parseable metadata (status, date) for tooling
- Should support a lifecycle (proposed → accepted → deprecated → superseded)

## Considered Options
1. MADR (Markdown Any Decision Records) v4.0
2. Nygard-format ADRs
3. Inline comments in code
4. No formal format (rely on tribal knowledge)

## Decision Outcome
Chosen option: "MADR v4.0", because it is the most structured and toolable ADR format with YAML frontmatter for machine-readable metadata and required sections for context, options, and outcome.

### Consequences
- Good: YAML frontmatter enables validation, status tracking, and CI integration
- Good: Required sections force thorough documentation of alternatives and trade-offs
- Good: Status lifecycle lets decisions evolve (supersede, deprecate)
- Bad: More structure than some teams want for small decisions

### Confirmation
AI agents should check decisions before implementing and the verify skill should confirm decisions were followed.
