---
status: implementing
complexity: 3
branch: refactor/harden-autonomous-apply-loop
design_ref: draft.md
---

# Change: Harden the autonomous apply loop

## Why
Autonomous `grimoire-apply` can loop until the token budget is exhausted, can't compound learnings between attempts, and has no cross-section thrash signal or guard against a reward-hacked red-green gate. This adds an instruction-level circuit breaker, an ephemeral two-lifecycle `learnings.md`, cross-section thrash detection, and a reward-hack guard. Solved when an autonomous run halts at a declared ceiling (not token exhaustion), a retry never repeats a recorded dead end, and durable facts learned during apply land in their one home.

## Non-goals
- Review mode is untouched.
- No change to the red-green discipline or the fixed-`tasks.md` "do not re-plan" rule.
- No pure-stateless outer shell-loop driver (rejected — see 0035).
- No parallel/worktree fan-out.
- No hard code-enforced breaker in v1 — instruction-only; cost/wall-clock caps are soft (deferred follow-up).
- No pre-apply spec↔plan↔tasks consistency gate (deferred to a plan/verify enhancement).

## Feature Changes
None. This is an internal process change to grimoire's own apply skill — it has no external actor and is not observable in a scenario, so it is routed off Gherkin (per the constraints register policy and ADR 0010). Verification is the existing check gate staying green plus `grimoire validate`.

## Scenarios Added
None.

## Scenarios Modified
None.

## Decisions
- **0035** harden-autonomous-apply-loop (proposed → accepted at finalize) — instruction-only hardening: learnings staging-file, circuit breaker, thrash detection, reward-hack guard; "one task sized to one context" over statelessness.

## Constraints
- Autonomous apply halts at a configured ceiling before token exhaustion (`TODO: unit-invariant`, instruction-only v1).
- A test is never weakened/deleted to pass the gate (`TODO: unit-invariant`, instruction-only v1).
