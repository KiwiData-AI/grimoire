---
status: superseded by 0047
date: 2026-09-03
decision-makers: [Fred]
---

# Separate question-driven spikes from delivery verification

## Context and Problem Statement

Grimoire applies test-first delivery rules to work whose behavior, contract, root cause, or implementation direction is still unknown.

This conflates learning with delivery. It encourages invented fixtures and assertions while repeatedly starting expensive test infrastructure.

This decision supersedes [0014](0014-contract-first-api-testing.md), [0035](0035-harden-autonomous-apply-loop.md), and [0044](0044-plan-review-timing-and-verification.md). It retains authoritative provider fixtures, apply working memory, soft run limits, cross-section thrash detection, and the reward-hack guard. It replaces their per-task red-green and autonomous retry rules.

## Decision Drivers

- Preserve test-first work after expected behavior and implementation direction are known.
- Prevent unresolved assumptions from becoming precise but fictional tasks, schemas, fixtures, endpoints, or assertions.
- Keep section feedback useful without repeatedly starting databases, containers, or broad test suites.
- Retain baseline evidence and complete final verification.
- Give engineering exploration one explicit, reusable workflow and stable result reference.
- Stop autonomous delivery after three failed implementation attempts.
- Keep lifecycle policy in one authoritative reference.

## Considered Options

1. Separate engineering spikes from section-level delivery and final verification.
2. Preserve strict red-green for every task and add integration-specific exceptions.
3. Remove test-first delivery and rely only on final verification.

## Decision Outcome

Chosen option: **separate engineering spikes from section-level delivery and final verification**, because exploration and delivery require different evidence.

An engineering spike starts with one question and evidence-based exit criteria. Focused probes and disposable code need no test-first execution.

Every spike ends as answered, disproved, blocked, or inconclusive. Its findings receive a stable `S<n>` reference.

Within a change or bug, `n` is the next unused positive integer. A standalone response starts at `S1`.

Active-change findings live in `learnings.md`. Bug findings live in `triage.md`. Standalone findings remain in the response unless directed elsewhere.

Apply working memory also retains transient failure notes and durable discovered facts. Configured cost and wall-clock limits remain soft limits. Repeated failure classes across sections still stop autonomous delivery. Tests cannot be weakened or deleted to force confirmation.

An answered spike may refine affected unchecked implementation mechanics. It cannot silently change approved behavior, scope, or architecture.

After three failed delivery attempts, delivery stops. A spike may summarize evidence for the human, but cannot authorize attempt four.

For understood planned-change delivery, tests are written before production code. Mechanical observation of red is not required.

For an understood bug fix, its permanent reproduction test must fail once before production code changes and pass afterward.

Each substantial section runs at most one simple confirmation after implementation. The confirmation is deferred when it requires database or container startup.

Full configured suites run once before delivery and once during final verification. Deterministic quality checks run once during final verification.

Unknown provider responses are explored before provider contract tests are written. Detailed provider-test mechanics live only in `testing-contracts.md`.

### Consequences

- Good: Tests and production assertions encode observed or approved behavior instead of exploratory assumptions.
- Good: Expensive databases, containers, and broad suites stop dominating the implementation loop.
- Good: Spike findings remain referenceable across planning, implementation, and bug investigation.
- Good: Baseline and final verification retain regression evidence.
- Bad: Some section defects surface only during final verification.
- Bad: A deferred section confirmation provides no intermediate executable signal.
- Bad: Skills must classify uncertainty consistently before choosing spike or delivery mode.

### Cost of Ownership

- **Maintenance burden**: Maintain one lifecycle reference, one spike skill, and contract tests ensuring consumers link to the reference.
- **Ongoing benefits**: Fewer repeated checks, fewer fictional contracts, and clearer handoffs when engineering work remains uncertain.
- **Sunset criteria**: Revisit if final verification repeatedly finds defects a cheap, predictable section confirmation would have caught.

### Confirmation

- Workflow features distinguish spikes, section confirmation, and final verification.
- Plan, apply, bug, triage, review, and verification skills cite one testing lifecycle reference.
- Skill contract tests reject invented provider contracts and per-task red-green requirements.
- Installation tests include `/grimoire:spike` for every supported agent.
- `package.json` and `package-lock.json` identify release `0.4.1`.
- Final configured deterministic checks, unit tests, and BDD tests pass.
