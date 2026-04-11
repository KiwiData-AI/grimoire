---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Contract-first external API testing strategy

## Context and Problem Statement
When grimoire-managed code depends on external APIs, tests need to handle those dependencies. Should grimoire prescribe a testing strategy for external API boundaries, and if so, what approach?

## Decision Drivers
- External API calls must not make real HTTP requests in unit/BDD tests
- Test fixtures must reflect the actual API contract, not invented data
- Contract drift (API changes without test updates) must be detectable
- Strategy must work across Python, TypeScript, Go, and Rust ecosystems

## Considered Options
1. Contract-first — mock at HTTP boundary, fixtures match `schema.yml`, verify drift
2. Consumer-driven contracts — use Pact or similar tool for bidirectional contract testing
3. Integration tests — test against real or staging APIs
4. No guidance — let teams decide their own API testing approach

## Decision Outcome
Chosen option: "Contract-first", because it provides a consistent strategy that works with grimoire's existing `schema.yml` data documentation. The plan skill mandates mocking at the HTTP boundary only (never mock internal code or client wrappers). Fixtures must match the documented contract in `schema.yml`. The verify skill detects contract drift — changes to external API documentation without corresponding test updates.

### Consequences
- Good: Tests are fast and deterministic (no real HTTP calls)
- Good: Fixtures stay in sync with documented API contracts
- Good: Verify skill catches when API contracts change but tests don't
- Good: Works with any HTTP mocking library (responses, nock, httptest, mockito)
- Bad: Contract drift detection is heuristic — compares `schema.yml` changes vs test changes
- Bad: Doesn't validate that the real API matches `schema.yml` (no Pact-style provider verification)
- Bad: Teams using consumer-driven contracts need to override the guidance

### Confirmation
If the verify skill correctly flags a `schema.yml` change that lacks corresponding test fixture updates, the decision is validated.
