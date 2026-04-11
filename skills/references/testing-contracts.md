# Testing & Contract Reference

Loaded by skills that involve writing tests, mocking external services, or verifying contract compliance.

## Mocking Strategy

**Mock at the HTTP boundary, not at the client level.**

- **DO mock**: the HTTP transport layer using the project's HTTP mocking library (check `config.tools` or existing test imports for: `responses`, `httpx_mock`, `nock`, `msw`, `wiremock`). Fixture responses must match the contract in `schema.yml`.
- **DON'T mock**: your own client wrapper. If you mock `stripe_client.create_charge()`, you're testing that your code calls a function — not that it handles the real response shape. The client wrapper is the code under test.
- **DON'T mock**: internal services within the same repo. Use the real code. Mocking between internal modules hides integration bugs that only surface in production.

## Fixture Management

- Fixtures live alongside tests (e.g., `tests/fixtures/stripe_create_charge.json`)
- One fixture per endpoint, named after the endpoint, not the test
- Each fixture is a concrete instance of the `schema.yml` contract
- When the contract changes, the fixture must change — stale fixtures are false-positive tests
- Include at least one error response fixture per external API (matching `error_response` in `schema.yml`)

## Contract Test Requirements

Every external API integration needs contract tests that assert:
1. Every `required: true` response field is read and typed correctly in the client
2. Request payloads match the documented shape (required fields present, types correct)
3. Error response handling matches the documented `error_response` shape
4. Use recorded/fixture responses (not live calls) so tests run locally without network

For contract regression tests: if the client starts reading a new field or stops sending a required field, the test must fail.

## Mocking Anti-Patterns

- Mocking your own client wrapper and asserting it was called — tests wiring, not behavior
- `unittest.mock.patch` on the function under test — replacing the thing you're testing
- Fixture responses that don't match any documented contract — fictional, prove nothing
- Mocking so aggressively that removing production code still passes the test
- Test creates a mock and asserts against the mock's return value (circular)

## Verify Before Using

Before importing a module, calling a function, or adding a dependency — confirm it exists.

**Imports and functions:**
- Check area docs' Reusable Code table first (exact paths and line numbers)
- If importing from a file you haven't read, read it first
- If an import fails, don't guess — read the actual module for the real export name

**Dependencies and packages:**
- Only add packages already in `package.json` / `requirements.txt` / `pyproject.toml` / equivalent
- If a task requires a new package, verify it exists (should be specified in the plan)
- Never guess at a package name

**APIs and endpoints:**
- Check `schema.yml` for external API contracts (real endpoints, methods, field names)
- For internal APIs, read the area doc or route file — don't assume paths

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
