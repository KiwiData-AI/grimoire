# Testing & Contract Reference

Loaded by skills that involve writing tests, mocking external services, or verifying contract compliance.

## Integration Boundary

Choose the test boundary by ownership.

- **Provider contract test:** exercise the real client wrapper through the HTTP transport boundary. Fixtures must be captured from an authoritative observed provider response and match `schema.yml`.
- **Repository orchestration test:** stub the repository-owned adapter-result type when the test targets orchestration around that adapter. This isolates owned coordination without claiming that the stub represents provider behavior.
- **Internal integration test:** use real internal repository modules when the contract between them is under test.

Never treat a repository orchestration stub as provider contract evidence. Never invent a provider response from documentation fragments, client code, or an assumed subset.

## Fixture Management

- Fixtures live alongside tests (e.g., `tests/fixtures/stripe_create_charge.json`)
- One fixture per endpoint, named after the endpoint, not the test
- Each provider fixture is a concrete instance of the `schema.yml` contract captured from an authoritative observed provider response
- When the contract changes, the fixture must change — stale fixtures are false-positive tests
- Include at least one error response fixture per external API (matching `error_response` in `schema.yml`)

## Test Data Generation

Tests follow required production behavior. Do not change production code or shared test
infrastructure merely to unify test setup.

Before adding test data or setup:

1. Find the existing owner of the same invariant and the area's fixture, factory,
   setup, and teardown pattern.
2. Reuse or extend that owner when it fits.
3. The first and second equivalent cases without a fitting owner use the smallest
   established local test pattern.
4. Before adding the third equivalent case, present the existing cases and request
   one user decision: consolidate now or retain another local case.

Do not add shared test infrastructure because repetition might occur later. Do not
replace working fixtures, factories, setup, teardown, or production workflows merely
to standardize a test. Do not delete pre-existing duplicate tests as incidental cleanup;
remove duplication introduced by the current plan unless the user approves broader
consolidation.

Recorded responses remain the data source for external-provider contracts. Property-
based generation remains appropriate when an accepted invariant covers an input space.
AI-authored literal data is acceptable when it is the smallest established local pattern
for a specific case; do not invent a broad dataset or new factory around it.

## Contract Test Requirements

Write provider contract tests only after authoritative responses have been observed. Each test must assert:
1. Every `required: true` response field is read and typed correctly in the client
2. Request payloads match the documented shape (required fields present, types correct)
3. Error response handling matches the documented `error_response` shape
4. Use authoritative recorded/fixture responses so routine tests run locally without network

For contract regression tests: if the client starts reading a new field or stops sending a required field, the test must fail.

## Mocking Anti-Patterns

- Mocking your own client wrapper and asserting it was called — tests wiring, not behavior
- Presenting a repository-owned adapter-result stub as evidence of provider behavior
- `unittest.mock.patch` on the function under test — replacing the thing you're testing
- Fixture responses that don't match any documented contract — fictional, prove nothing
- Mocking so aggressively that removing production code still passes the test
- Test creates a mock and asserts against the mock's return value (circular)

## Verify Before Using

Before importing a module, calling a function, or adding a dependency — confirm it exists.

**Imports and functions:**
- Query the graph first (`search_graph` / `get_code_snippet`) for the exact symbol, path, and signature
- If importing from a file you haven't read, read it first
- If an import fails, don't guess — read the actual module for the real export name

**Dependencies and packages:**
- Only add packages already in `package.json` / `requirements.txt` / `pyproject.toml` / equivalent
- If a task requires a new package, verify it exists (should be specified in the plan)
- Never guess at a package name

**APIs and endpoints:**
- Check `schema.yml` and authoritative observed responses for external API contracts
- For internal APIs, read the area doc or route file — don't assume paths

## Step Definition Conventions

Step definitions are organized by **domain concept**, NOT by feature file. One step file per feature file is an anti-pattern — steps should be reusable across features.

**Before writing step definitions, check the project's existing test setup.** Read test config files, existing step definitions, and `package.json` / `requirements.txt` / `pyproject.toml` to determine which framework is in use and follow its conventions.

**Key rules:**
- NEVER create one step definition file per feature file
- Given steps are most likely to be shared — put them in a common location
- When/Then steps are more domain-specific — group by domain
- If a step is used by 2+ features, move it to the shared/common file
- Step definition bodies should be thin — delegate to helper functions, page objects, or API clients
- **Match the project's existing patterns.** Don't introduce a new framework.

Common patterns by ecosystem (use as reference, not gospel — follow the project's actual conventions):

**Python (Behave):** `features/steps/` with `auth_steps.py`, `common_steps.py`, `environment.py`

**Python (pytest-bdd):** `tests/conftest.py` for shared fixtures + `tests/step_defs/test_auth.py` per domain

**JavaScript/TypeScript (Cucumber.js):** `features/step_definitions/` with `auth.steps.ts`, `common.steps.ts`, `features/support/world.ts`

**React / Frontend (Playwright/Cypress + Cucumber):** `e2e/steps/` with domain step files + `e2e/pages/` for page objects

## Step Definition Quality

Every Then step must have a specific assertion with an exact expected value:
- **Strong:** `assert result == "expected_value"`, `expect(status).toBe(302)`
- **Weak:** `assert result is not None`, `expect(result).toBeDefined()`
- **Trivial:** `assert True`, `pass`, empty body — always CRITICAL

Anti-patterns:
- `def step_impl(): pass` — empty body, always passes
- Asserting against the return value of the function you just wrote (circular)
- `assert True` or `assert response is not None` — trivially true
- Catching exceptions in the step def so it never fails
- No `assert`/`expect` in a Then step — CRITICAL
