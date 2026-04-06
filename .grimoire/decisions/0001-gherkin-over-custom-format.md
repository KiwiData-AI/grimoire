---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Use Gherkin instead of custom WHEN/THEN format

## Context and Problem Statement
We need a format for behavioral requirements that AI agents can read and that doubles as executable tests. OpenSpec uses a custom WHEN/THEN markdown format that is documentation-only — it cannot be executed.

## Decision Drivers
- Specs should be executable as acceptance tests, not just documentation
- Must have a mature tool ecosystem (test runners, parsers, IDE support)
- AI agents should be able to generate step definitions from specs
- Format should capture preconditions explicitly

## Considered Options
1. Gherkin (Given/When/Then with Feature/Scenario structure)
2. OpenSpec custom WHEN/THEN markdown
3. Plain markdown with test generation

## Decision Outcome
Chosen option: "Gherkin", because it is the only format that is both human-readable as a spec and directly executable as a test via Cucumber, pytest-bdd, Behave, and other BDD frameworks.

### Consequences
- Good: Every spec is automatically a test — no drift between spec and implementation
- Good: Large ecosystem of tools, parsers, and IDE plugins
- Good: Given captures preconditions explicitly (OpenSpec's format lacks this)
- Bad: Gherkin syntax is more rigid than freeform markdown
- Bad: Some developers find Given/When/Then verbose for simple behaviors

### Confirmation
If feature files are being used as both requirements and acceptance tests across multiple projects, the decision is validated.
