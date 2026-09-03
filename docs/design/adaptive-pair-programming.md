# Spikes, Section Delivery, and Final Verification

**Status:** Accepted

**Scope:** Portable Grimoire planning, implementation, review, and verification.

## Problem

Question-driven investigation and understood delivery need different evidence. Treating both as tactical red-green work encourages fictional contracts and repeats expensive setup.

## Goals

- Route unknown behavior, contracts, causes, reproductions, and directions to engineering spikes.
- Keep plans to substantial sections with activity-level review timing.
- Write known section tests before planned production code.
- Run at most one section confirmation after implementation.
- Run one `grimoire-verify` procedure with one pre-commit review and one final suite run.
- Preserve optional harness-level per-file review outside Grimoire state.

## Artifact Routing

Gherkin is reserved for clear actor-visible behavior. Internal optimizations, refactors, configuration, protocols, and implementation details use their appropriate tests or decisions.

Unknown mechanics are represented by `S<n>` spike activities. Each spike asks one question, names required evidence, bounds probes, and exits as answered, disproved, blocked, or inconclusive.

## Planning Contract

Plans use one substantial implementation section by default. A second section requires a distinct outcome or context boundary. Every activity receives `structure-before` or `slice-after` review timing.

A planned section contains:

- Activities with exact files, known tests, and production changes.
- At most one cheap post-section confirmation.
- A deferral when meaningful confirmation requires database or container startup.

Unresolved assumptions become referenced spikes. Planning does not invent downstream tasks, schemas, fixtures, endpoints, responses, or assertions.

## Review Timing

Use `structure-before` for costly-to-reverse shapes such as data relationships, ownership boundaries, public interfaces, dependency direction, transactions, queues, concurrency, and external boundaries.

Use `slice-after` for autonomous implementation. These activities join the consolidated pre-commit review. Optional harness-level per-file review adds no portable Grimoire metadata.

## Apply Lifecycle

Apply records every configured suite once as the accepted baseline. Each substantial section then follows this cadence:

1. Write all known section tests.
2. Implement every covered activity.
3. Run one section confirmation, or defer it by policy.
4. Mark covered activities complete together.

Planned delivery does not run tests only to observe red. Unknown work enters a spike. After three failed delivery attempts, a findings-only spike presents evidence and requires human direction before attempt four.

Understood bug fixes retain one observed failing reproduction before production changes and one passing reproduction afterward.

## Provider Boundaries

Provider contract fixtures require authoritative observed responses. Repository orchestration may stub its owned adapter-result type without claiming provider-contract coverage.

## Verify Lifecycle

After all sections, apply invokes one `grimoire-verify` procedure:

1. Validate Grimoire artifacts.
2. Run deterministic non-test checks.
3. Invoke one pre-commit review over the complete diff.
4. Apply one accepted correction batch.
5. Run an affected section confirmation only when needed.
6. Run one final suite run covering every configured unit and BDD suite.
7. Compare failures with the accepted baseline.

Focused reruns after a final-suite failure diagnose only that observed failure.

Generated editor and commit hooks provide cheap lint, format, and doc-style feedback. They do not run configured unit or BDD suites.

## Session and Resume Rules

Each substantial section uses a fresh implementation context. Task checkboxes remain the resume state. A section handoff records confirmation evidence and facts needed later.

Failure-mode notes prevent repeated approaches. Implementation lessons carry user corrections affecting unchecked work. Spike lessons carry referenced investigation evidence. Durable facts move to their authoritative home during finalization.

## Acceptance Criteria

- Plans use substantial sections and activity-level review timing.
- Unknown work uses `S<n>` spikes with evidence-based exits.
- Planned tests precede production code without a mechanical red run.
- Each section has at most one section confirmation.
- Baseline and final configured suites run once each.
- Generated hooks exclude configured unit and BDD suites.
- Apply invokes one `grimoire-verify` procedure.
- Verify runs one pre-commit review and one final suite run.
- Provider contract fixtures use observed evidence.
- Harness-level per-file review remains outside Grimoire state.
