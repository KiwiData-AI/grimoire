---
status: accepted
date: 2026-08-21
decision-makers: [Fred]
---

# PR Gate Enforces Finalization with a Shared Health Check

## Context and Problem Statement
An audit of a consumer repo (bake, 2026-08-21) showed finalization never runs in practice: stale change folders, trivial ADRs, constraint rows citing nonexistent tests, and most commits missing the `Change:` trailer. The package's own artifacts cause this: the `grimoire-pr` skill's prerequisites demand the change folder be already removed while its workflow reads that folder (it can literally never run), `AGENTS.md` points the PR stage at the bare CLI, and nothing stops `gh pr create` from bypassing the workflow entirely. Where should finalization be enforced, and where does health checking live?

## Decision Drivers
- Finalization must have exactly one definition (one right way)
- The enforcement point must sit where drift enters: PR creation
- Health rules are needed by two consumers (per-change gate, repo-wide report) — one source
- Checks must work in any grimoire project, not one ecosystem
- No auto-fixing: reports and gates, not silent mutation
- PR generation must work after finalization removes ephemeral change state
- Final review must bind the complete ordinary Git index to one immediate final commit
- Ephemeral cleanup requires a prior ordinary commit with durable work and the current change identity

## Considered Options
1. Keep finalize in `grimoire-apply`; make `/grimoire:pr` the enforcing gate that executes apply's finalize when missing
2. Move finalization ownership into `grimoire-pr` (gather → finalize → describe)
3. Enforce via CI (hard gate on the health check)
4. Status quo plus documentation fixes only

## Decision Outcome
Chosen option: "Keep finalize in `grimoire-apply`; `/grimoire:pr` is the enforcing gate", because it preserves one definition home while adding enforcement at the moment drift enters — the PR — and hardening apply's own finalize language covers the other entry point (sessions ending at "tests green").

### Mechanics

Ordinary mid-process commits require the `Change:` trailer. They do not require `Final-production-review: approved`, which is reserved for the final commit. Before cleanup, at least one ordinary commit must carry the current change identity. The qualifying commit contains durable verified work only and excludes active change-folder scaffolding.

Finalization records durable state while the active change context remains available. This includes decision status, schema changes, learned facts, and explicit deferrals. It then removes the ephemeral change folder, regenerates project documentation after that removal, and stages every durable change together in the ordinary Git index.

Finalization presents the complete staged path list grouped as production or support. It then presents the full diff from the target branch merge base to that index without excluding any path. Approval covers the entire index and is followed immediately by one final commit with `Change:` and `Final-production-review: approved` trailers. The workflow creates no review snapshot, digest, synthetic ref, synthetic index, review worktree, or cleanup-only commit.

`grimoire-pr` invokes apply finalization when an active change folder remains. After cleanup, the existing `grimoire pr` generator derives change identity and description content from Git history, `Change:` trailers, and changed live features and decisions. A branch may contain multiple related change IDs when every commit body contains at least one `Change:` line; explicit PR change selection resolves identity. PR generation and health checks therefore do not depend on removed process scaffolding.

Repo-wide drift checking integrates into the existing `grimoire health` command. Mechanical checks become a spec-drift metric in `src/core/health.ts`; judgment checks remain agent-run per `health-check.md`. `grimoire-discover` reports both groups without mutation. All checks use configured tools rather than ecosystem-specific commands.

### Consequences
- Good: finalization keeps one home; the gate makes skipping it visible instead of silent.
- Good: one health-check definition serves both the PR gate and the drift report; one "health" surface (`grimoire health`) avoids a second same-named report.
- Good: the description generator gets one home (CLI); the skill becomes its caller.
- Good: the complete ordinary Git index is the review boundary and the final commit payload.
- Good: PR generation survives cleanup because durable Git history and live artifacts are authoritative.
- Bad: enforcement is instruction-level — a determined direct `gh pr create` still bypasses it; CI enforcement deliberately deferred.
- Bad: the trailer records the approval assertion but does not cryptographically bind the approved diff to the commit.
- Bad: `grimoire-pr` reads another skill's section (`grimoire-apply` §7) — a cross-skill dependency to keep in sync.
- Bad: interrupted finalization must resume from ordinary Git state after ephemeral context is removed.

### Quality Attributes

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| Consistency | Every merged change's id appears in a `Change:` trailer on main | `git log main --format="%(trailers:key=Change,valueonly)"` spot check |
| Review integrity | Approval is followed immediately by one final commit without index mutation | observed workflow sequence and final-review trailer |
| Safety | Health checks report; the only mutation is per-change finalize with user-visible output | review of skill text |
