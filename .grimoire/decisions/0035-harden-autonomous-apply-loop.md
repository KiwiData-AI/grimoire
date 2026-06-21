---
status: accepted
date: 2026-06-21
decision-makers: [fred]
---

# Harden the autonomous apply loop: learnings staging-file, instruction-only circuit breaker, cross-section thrash detection

## Context and Problem Statement

`grimoire-apply` autonomous mode is a spec-driven implementation loop — the same family as spec-kit / Kiro, and already ahead of the classic Ralph loop on the two things that matter most: a real verification gate (red-green + baseline) and anti-drift (fixed approved `tasks.md`, "do not re-plan"). Those are keepers.

Against current loop SOTA it has three gaps that surface as cost and quality risk in long autonomous runs:

1. **No loop-level ceiling.** A per-task 3-attempt cap exists; nothing bounds the *run*. Reported failure mode (`RESEARCH.md:25`): loop until token budget is exhausted. Field cautionary tales: a stuck retry burning hours of spend with no cost cap; a compaction spiral issuing ~250K API calls/day before detection.
2. **Learnings don't compound.** Only the last handoff note is re-read; scaffolding is deleted at finalize. The universal pattern (Ralph `fix_plan.md`/`AGENT.md`, persistent project rules) is a note fed back each iteration so the next attempt can't blindly repeat a dead end.
3. **No cross-section thrash signal, and a gameable gate.** The 3-attempt cap is per-task; two sections cycling the same error in a row should halt the whole run. And the red-green gate is reward-hackable — weaken or delete a test and it goes green without solving anything.

## Decision Drivers

- Bound autonomous cost/time without regressing the red-green gate or the fixed-`tasks.md` rule (grimoire's edge over Ralph).
- Make the loop self-correcting: a failed attempt should leave information the next attempt can use, so the breaker is a last resort, not the first line.
- One authoritative home per fact-type — learnings must not pollute `AGENTS.md` and must be correctable so they don't go stale.
- Skills are pure markdown (ADR 0010) — prefer an instruction-level solution; be honest about what markdown cannot enforce.

## Considered Options

1. **Pure-stateless Ralph driver** — an outer shell loop (`while … claude -p`) restarting fresh context every iteration.
2. **Hard-enforced breaker in code now** — caps logic in `bin/grimoire.js` or a hook so the ceiling is actually enforced.
3. **Instruction-only hardening in the apply skill** — an ephemeral per-change `learnings.md` (two lifecycles), cross-section thrash detection that reads its failure trail, an instruction-level circuit breaker, and a reward-hack guard; "one task sized to one context" replaces statelessness.

## Decision Outcome

Chosen option: **Option 3 (instruction-only hardening)**, because it closes all three gaps as markdown — staying within ADR 0010 — while preserving the verification gate and anti-drift that already beat Ralph.

Rejected:
- **Option 1** — statelessness is a context-rot *mitigation*, not a goal. It only pays off when a task overflows one context, which grimoire treats as an anti-pattern (oversized change → split the spec). The right tenet is **"one task sized to one context": stateful within a task, reset between tasks** — the existing fresh-subagent-per-section already realizes the "reset between" half.
- **Option 2** — larger scope, touches code; deferred. The cost/wall-clock caps genuinely need code to be airtight; v1 ships them as honest *soft* caps with a follow-up.

The learnings file carries two sections with two lifecycles:
- **Failure-mode notes** — transient. Appended after a failed attempt, read before any retry, pruned the moment a task goes green, never promoted.
- **Discovered facts** — durable. Staged with their destination home, reconciled into that one home at finalize (an area doc / decision / constraint / schema / feature — never `AGENTS.md`), then cleared.

Compounding learnings is the antidote to thrash: cross-section detection reads the failure trail and trips the breaker when one section's error class repeats the prior section's. Caps live under `llm.coding.limits` in `.grimoire/config.yaml` (`max_sections_without_checkpoint: 5`, `consecutive_blocked: 2`, `max_cost_usd: null`, `max_wallclock_min: null` — null = unbounded unless set). The human checkpoint sits at the PR/merge boundary, not inline (the verification gap is structural).

### Consequences
- Good: autonomous runs halt at a declared ceiling instead of token exhaustion; retries can't repeat recorded dead ends; durable facts land in their one home instead of evaporating; the gate is protected from reward-hacking.
- Good: no new code, no new dependency — pure skill/template/doc edits.
- Bad: the breaker is instruction-only in v1 — cost/wall-clock caps are advisory, not enforced. An agent that ignores the instruction is not stopped by the harness.
- Bad: adds a third ephemeral file (`learnings.md`) to the change folder and two reconciliation steps to apply.

### Quality Attributes

Not applicable — this is an internal process change with no runtime performance surface.

### Cost of Ownership
- **Maintenance burden**: one new template (`templates/learnings.md`) and added instructions in `grimoire-apply/SKILL.md`; caps to keep in sync with `config.yaml` docs. Two constraints carried as `TODO` until enforcement lands.
- **Ongoing benefits**: bounded autonomous spend; fewer repeated-dead-end loops; durable facts captured instead of lost.
- **Sunset criteria**: revisit when hard enforcement is needed (promote the breaker into `bin/grimoire.js`/a hook and convert the two constraints to real unit-invariants), or if a concrete multi-section bottleneck justifies parallel worktree fan-out.

### Confirmation
- v1: review confirms `grimoire-apply/SKILL.md` carries the learnings, thrash-detection, breaker, and reward-hack-guard instructions; `templates/learnings.md` exists with both sections; the existing check gate (`grimoire validate` + lint + tests) stays green with no regression.
- The two guarantees enter `.grimoire/docs/constraints.md` now with `TODO: unit-invariant` (verified once the breaker/guard are enforced in code).
