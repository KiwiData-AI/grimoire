# Constraints

> Invariants that must always hold. These are **not** behaviors (no external actor,
> not observable in a scenario) — they are guarantees. Anything that failed the
> feature-file admission test in `grimoire-draft` because it is a security control,
> NFR, performance budget, observability guarantee, or compliance rule lives here,
> **not** in a `.feature`.
>
> Each constraint is verified by a `unit-invariant` test (created at plan/apply),
> never by a Gherkin scenario. Keep this register narrow: assert, justify, point to
> the proof. Don't let it grow into an issue tracker — open work belongs in your
> tracker, not here.

| Constraint (assertion) | Rationale | How verified | Links |
|------------------------|-----------|--------------|-------|
| _e.g._ Log output never contains PII or secrets | Confidential data must not leak to logs/stdout | `tests/test_log_scrubbing.py::test_pii_redacted` | [ADR-0008](.grimoire/decisions/0008-...) |
| _e.g._ Every request is isolated to its tenant | Multi-tenant data separation | `tests/test_tenant_isolation.py` | — |

<!--
Add one row per constraint. Guidance:
- Assertion: a flat "X always holds" statement. No Given/When/Then.
- Rationale: why it matters, in one line.
- How verified: the exact test id that proves it. If none yet, write "TODO: unit-invariant test" — the plan stage will create it.
- Links: the MADR that decided it (don't restate the decision here — DRY).
-->
