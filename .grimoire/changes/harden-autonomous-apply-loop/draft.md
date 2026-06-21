---
status: draft
change-id: harden-autonomous-apply-loop
kind: refactor
---

# Harden the autonomous apply loop — draft

**Date:** 2026-06-21 · **Provenance:** review of `grimoire-apply` autonomous mode against the Ralph loop + 2025–2026 spec-driven loop SOTA (spec-kit, Kiro, Tessl; Anthropic Agent SDK breakers; Ralph `fix_plan.md`/`AGENT.md`). Research synthesized this session.

## At a glance

```
grimoire-apply autonomous mode TODAY                     HARDENED
───────────────────────────────────                     ────────
parent orchestrator (persists)                           parent orchestrator (persists)
  └─ subagent per section (fresh)                           └─ subagent per section (fresh)
       └─ task: test→red→code→green                              └─ reads learnings.md ──┐
       └─ stuck? 3-attempt cap (per-task)                        └─ task: red→green       │
       └─ exit, write handoff note                               └─ stuck? 3-attempt cap  │
                                                                  └─ append failure note ─┘
no loop-level ceiling  ──────────────┐                    GLOBAL BREAKER (hard ceiling)
no cross-section thrash signal       │  death-spiral       ├─ sections-without-checkpoint cap
only last handoff note re-read       │  risk               ├─ cost / wall-clock cap
learnings evaporate per section      │                     └─ consecutive-BLOCKED halt
                                     ┘                            ▲ triggered by
                                                           THRASH DETECTOR (reads failure trail)
                                                           LEARNINGS.md (staging area, two lifecycles)
                                                           REWARD-HACK GUARD (no weakening tests to go green)
```

## Why

`grimoire-apply` autonomous mode is already a structured spec-driven loop — same family as spec-kit / Kiro, and **ahead of vanilla Ralph** on the two things that matter most: a real verification gate (red-green + baseline) and anti-drift (fixed approved `tasks.md`, "do not re-plan"). Those are keepers; this change must not regress them.

But against SOTA it has three gaps that surface as cost and quality risk in long autonomous runs:

1. **No loop-level ceiling.** Per-task 3-attempt cap exists; nothing caps the *run*. Field cautionary tales: $313 burned in 8.5h on a stuck retry with no `--max-cost`; a compaction spiral hit ~250K API calls/day before anyone noticed. Anthropic Agent SDK ships `max_turns` + `max_budget_usd` as standard circuit breakers; `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3` is the in-product example.
2. **Learnings don't compound.** Only the *last* handoff note is re-read; scaffolding is deleted at finalize. The universal pattern (Ralph `fix_plan.md`/`AGENT.md`, Anthropic `CLAUDE.md`) is a durable note fed back each iteration so the next attempt can't blindly repeat a dead end.
3. **No cross-section thrash signal.** The 3-attempt cap is per-task; two sections cycling the same files/errors in a row should halt the whole run, not just retry locally.

**How we'll know it's solved:** an autonomous run that gets stuck halts at a bounded, declared ceiling (not token exhaustion); a retry never repeats a recorded dead end; durable facts learned during apply land in their one home instead of evaporating.

**Non-goals:** review mode is unchanged. No parallel/worktree fan-out. No new outer shell-loop driver. No change to the red-green discipline or the fixed-`tasks.md` rule.

## Current state

How autonomous apply works today (`skills/grimoire-apply/SKILL.md`):

- Parent orchestrator reads `tasks.md`, spawns a fresh **subagent per section** (`SKILL.md` §"Session Management", lines ~124-157). Parent does not write code; it only delegates and checks completion between sections.
- Each task runs strict red-green: test→red→code→green→mark `[x]` (§5, lines ~226-261).
- **Stuck detection** is per-task: 3 attempts with fundamentally different approaches, then `<!-- BLOCKED: ... -->` in `tasks.md` and stop (§"Stuck Detection & Recovery", lines ~87-116). Mirrors `AGENTS.md` §Anti-Loop Protocol (attempt budget 3).
- **Handoff notes**: a `<!-- SESSION: ... -->` note written under the last task at section exit (lines ~172-180). Only the most recent is read by the next section.
- The change folder is ephemeral — `manifest.md` + `tasks.md` (+ optional `data.yml`) + `draft.md`, deleted at finalize (§7 step 5, line ~293).

**Gaps / drift (severity-ranked):**
1. **(high)** No global ceiling on an autonomous run — only token budget bounds it. Failure mode named in `RESEARCH.md:25` (loop-until-budget-exhausted) is not structurally prevented.
2. **(high)** Cross-section thrash is invisible — per-task cap can't see a section-over-section cycle.
3. **(med)** Learnings evaporate — only the last handoff note carries forward; durable facts discovered during apply are not routed to their home; the red-green gate is reward-hackable (weaken/delete a test to go green) with no explicit guard. METR (June 2025): o3 hacked the eval rather than solve the task.

## Decisions

| #  | Decision | Why |
|----|----------|-----|
| D1 | Scope = autonomous-mode robustness only. Review mode and the red-green/fixed-`tasks.md` discipline are untouched. | Those are grimoire's edge over Ralph; the gaps are loop-level, not per-task. |
| D2 | Reject a pure-stateless outer shell-loop driver (Ralph's `while … claude -p`). | Statelessness is a context-rot *mitigation*, not a goal. It only pays off when a task overflows one context — which grimoire already treats as an anti-pattern (big refactor). |
| D3 | Adopt instead **"one task sized to one context"**: stateful *within* a task, reset *between* tasks. Context overflow mid-task is a **smell** → "split the spec", not a normal mode. | Keeps reasoning continuity for free on small spec deltas; the existing fresh-subagent-per-section already realizes the "reset between" half. |
| D4 | Add one ephemeral `learnings.md` per change, **two sections / two lifecycles**: *failure-mode notes* (transient, pruned the moment a task goes green, never promoted) and *discovered facts* (durable, reconciled into their one home at finalize, then cleared). | Append-only is rot fuel and blurs human vs agent authorship. Treat learnings as the working tree to the spec's committed state (git's model, not a reinvented ledger). |
| D4a | Discovered facts are **never** written to `AGENTS.md`. They route to an area doc / decision / constraint / schema / feature — the fact's authoritative home. `AGENTS.md` stays human-owned. | One authoritative home per fact-type; reconciliation into a home is what keeps the fact from going stale. |
| D5 | Add **cross-section thrash detection** that reads the failure-mode trail. Its job is to *trigger the breaker*, not to retry. | Compounding learnings is the antidote to thrash: a failed attempt records "tried X, broke Y" so the next attempt has new info — the breaker becomes last resort, not first line. |
| D6 | Add a **global circuit breaker** (hard ceiling) for autonomous mode: sections-without-human-checkpoint, cost, wall-clock, and consecutive-BLOCKED-sections caps. On trip: stop, diagnose, hand to user. | Field standard (Agent SDK `max_turns`/`max_budget_usd`). Cheap insurance against death-spirals. |
| D7 | Add a **reward-hacking guard**: during apply, weakening or deleting a test to make the gate pass is stop-and-flag, not a valid green. | The red-green gate is the convergence signal; gaming it produces plausible-wrong code faster. |
| D8 | Human checkpoint for autonomous mode sits at the **PR/merge boundary**, not inline. | The verification gap is structural (Osmani 70% problem; METR 19%-slower; Willison "reviewer is first layer of QC"). Don't pretend the loop self-closes. |
| D9 | Caps are **configurable** in `.grimoire/config.yaml` with sane defaults; the breaker is documented as instruction now, with a follow-up to enforce it where the harness allows. | Config over hardcode. Skills are pure markdown (ADR 0010) — a prose-only breaker isn't *enforced*; flag the enforcement boundary honestly rather than imply it's airtight. |

## Sketches

`learnings.md` shape (not final — projected to `templates/learnings.md`, created per-change like `tasks.md`):

```markdown
# Learnings — <change-id>
<!-- Ephemeral. Removed at finalize with the change folder. Re-read at every
     section start and before every retry. Two sections, two lifecycles. -->

## Failure-mode notes
<!-- Transient. One line per dead end. Read before any retry; prune a task's
     entries the moment it goes green. Never promoted. -->
- <task-id> · tried <approach> · failed: <observed error / why>

## Discovered facts
<!-- Durable. Staged until reconciled into the one home that owns the fact at
     finalize, then cleared. Never AGENTS.md. -->
- fact: <what was learned> → home: <area doc | decision | constraint | schema | feature>
```

Breaker + thrash, as apply-skill instruction (shape, not contract):

```
between sections (parent orchestrator):
  if sections_since_checkpoint >= cap.sections        → halt: checkpoint with user
  if run_cost >= cap.cost or elapsed >= cap.wallclock → halt: declare ceiling hit
  if last two sections both ended BLOCKED             → halt: cross-section thrash
  if a section's failure-mode trail repeats the prior section's error class → halt
on halt: state the trip reason + diagnosis (what cycled, what was tried) and hand to user.
```

## Constraints

- An autonomous apply run MUST NOT exceed the configured cost / wall-clock / section ceiling without a human checkpoint · prevents token-exhaustion death-spirals · verified by a unit-invariant test on the breaker decision. → `.grimoire/docs/constraints.md`
- During apply, a test MUST NOT be weakened or deleted to make the gate pass · the red-green gate is the convergence signal and gaming it defeats verification · verified by a guard check / unit-invariant. → `.grimoire/docs/constraints.md`

## Decided / Open

**Decided:**
- D1 scope; D2/D3 sizing-over-statelessness; D4/D4a learnings staging-area; D5 thrash→breaker; D6 breaker caps; D7 reward-hack guard; D8 PR-boundary checkpoint.
- The learnings-file piece (D4/D4a) has a complete apply-ready edit set already drafted (new `templates/learnings.md`; edits to `grimoire-apply/SKILL.md` stuck-detection, task loop, subagent prompt, finalize; `AGENTS.md` invariant + directory blocks).

**Open:**
- ~~O1 — enforcement boundary.~~ RESOLVED: **instruction-only for v1** (D9). Breaker lives in `grimoire-apply/SKILL.md` as orchestrator instruction. Section + consecutive-BLOCKED caps are followable behavior; cost/wall-clock are honest *soft* caps the agent self-reports against. Deferred follow-up: a `bin/grimoire.js`/hook guard for hard enforcement. The two constraints enter `constraints.md` now with `TODO: unit-invariant` (verified once enforcement lands).
- ~~O2 — thrash detector state.~~ RESOLVED: the failure-mode trail in `learnings.md` is the v1 signal — the parent reads each section's trail and halts when one section's error class repeats the prior section's. No separate per-section record file. (D5)
- ~~O3 — cap defaults + config keys.~~ RESOLVED: caps live under `llm.coding.limits` in `config.yaml` (the `llm.coding` block already exists). Proposed defaults: `max_sections_without_checkpoint: 5`, `consecutive_blocked: 2`, `max_cost_usd: null` (opt-in), `max_wallclock_min: null` (opt-in). Null = unbounded unless the user sets it.
- ~~O4 — phasing.~~ RESOLVED: **one change** covering D4/D4a (learnings) + D5 (thrash) + D6 (breaker) + D7 (reward-hack guard). All instruction-only markdown, so a single coherent skill edit is cleaner than splitting.

## Cut / deferred

| Cut | What it was | Why cut | Re-add when |
|-----|-------------|---------|-------------|
| Parallel worktree fan-out | `[P]`-marked sections run in isolated worktrees, merge per PR | Real complexity; tension with sequential TDD discipline | Sequential loop is hardened and a concrete multi-section bottleneck shows up |
| Pure-stateless shell driver | Ralph `while … claude -p` outer loop | Statelessness ≠ goal; small spec deltas fit one context (D2/D3) | A task genuinely can't be sized to one context and splitting fails |
| Pre-apply consistency gate | spec-kit `/analyze`: spec↔plan↔tasks coherence check before apply | Out of scope (a plan/verify concern, not the loop); keep this change tight | Revisited as a `grimoire-plan`/`grimoire-verify` enhancement |
