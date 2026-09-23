---
status: proposed
date: 2026-09-23
decision-makers: [Fred]
---

# Diagnose test failures before rerunning

## Context and Problem Statement

A narrow assertion failure can trigger broader and increasingly expensive test runs before Grimoire interprets the observed result. Partial evidence can then become an unsupported root-cause conclusion.

This decision supersedes [0045](0045-separate-spikes-from-delivery.md). It retains separate spike and delivery modes, mandatory baseline and final configured-suite boundaries, section confirmation limits, and the three-attempt breaker. It adds one diagnosis gate for every test failure.

## Decision Drivers

- Resolve useful failure evidence before spending time on another run.
- Keep diagnostic execution focused on establishing root cause.
- Prevent plausible hypotheses from becoming proven conclusions without sufficient evidence.
- Reward an honest unknown paired with targeted diagnostic actions.
- Avoid unrelated failures and setup costs during diagnostic reruns.
- Stop dependent verification when existing output proves a required prerequisite is unavailable.
- Retain broad regression evidence at the baseline and final verification boundaries.
- Keep testing policy in one authoritative lifecycle reference.

## Considered Options

1. Inspect every failure before rerunning and require each diagnostic rerun to resolve an explicit root-cause unknown.
2. Preserve the existing focused-rerun rule without an evidence or root-cause gate.
3. Replace mandatory baseline and final boundaries with risk-selected suites.

## Decision Outcome

Chosen option: **inspect every failure before rerunning and require each diagnostic rerun to resolve an explicit root-cause unknown**, because failure output and the relevant code often answer the decisive question without more execution.

After any test failure, Grimoire inspects the failing assertion, complete observed result, expected contract, and narrow code path before another test run.

Grimoire prioritizes the earliest concrete error or unavailable prerequisite over a later timeout. When output proves a required service or prerequisite is unavailable, Grimoire reports that blocker and does not run another dependent test or broader suite. Dependent verification resumes only after restoration or explicit user direction.

If no authoritative artifact establishes the expected outcome, Grimoire asks the user before changing code or tests. Current implementation behavior does not prove the intended contract.

A diagnostic rerun must resolve at least one explicit unknown about the root cause that existing evidence cannot resolve. Grimoire selects the narrowest deterministic test that can resolve that unknown. Scope broadens only for a named plausible interaction or an explicitly justified integration boundary.

Mandatory baseline and final configured-suite runs remain unchanged. The diagnosis gate applies to failures observed at those boundaries and to section confirmations, bug reproductions, deterministic checks, and correction reruns.

Root-cause reports separate observations, hypotheses, and proven conclusions. Partial or incomparable evidence supports a hypothesis only. A proven conclusion requires sufficient comparable evidence and elimination of material alternatives.

When evidence does not establish the cause, Grimoire states that the cause is unknown, presents established observations, and proposes narrow diagnostic actions. Each action identifies at least one root-cause unknown it would resolve. This is a successful diagnosis state, not a failure that requires a plausible explanation.

### Consequences

- Good: Existing failure output and code inspection can resolve simple assertion mismatches without broad reruns.
- Good: Every diagnostic rerun has explicit expected information gain.
- Good: Reports remain honest when evidence is incomplete or workloads are incomparable.
- Good: Agents receive a useful completion path without inventing certainty.
- Good: Known environment blockers stop dependent suite timeouts instead of causing broader retries.
- Good: Mandatory boundary suites retain broad regression evidence.
- Bad: Agents must spend time inspecting output and code before rerunning even when a retry appears obvious.
- Bad: Some investigations will stop as inconclusive instead of offering a plausible root cause.

### Quality Attributes

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| Diagnostic efficiency | No diagnostic rerun without an explicit root-cause unknown | Skill contract tests inspect lifecycle and consumer guidance |
| Evidence integrity | Partial evidence remains labeled as a hypothesis | Skill contract tests inspect root-cause reporting rules |

### Cost of Ownership

- **Maintenance burden**: Keep the diagnosis gate in the shared testing lifecycle and retain only concise links in consumer skills.
- **Ongoing benefits**: Shorter failure cycles, fewer unrelated test failures, and fewer unsupported causal claims.
- **Sunset criteria**: Revisit if agents cannot apply the gate consistently or if mandatory inspection delays exceed avoided rerun costs.

### Confirmation

- `features/workflow/build-test-first.feature` describes diagnosis-before-rerun and evidence classification.
- Skill contract tests require inspection before rerun, one explicit root-cause unknown per diagnostic rerun, narrow test selection, and hypothesis labeling for partial evidence.
- Skill contract tests require a proven unavailable prerequisite to block dependent tests and broader suites.
- Skill contract tests treat an honest unknown with targeted diagnostic actions as a valid diagnosis outcome.
- Apply, bug, and verify skills invoke the shared diagnosis gate for their failure paths.
- `package.json` and `package-lock.json` identify release `0.4.2`.
- Final configured deterministic checks, unit tests, and BDD tests pass.
