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

## Considered Options
1. Keep finalize in `grimoire-apply`; make `/grimoire:pr` the enforcing gate that executes apply's finalize when missing
2. Move finalization ownership into `grimoire-pr` (gather → finalize → describe)
3. Enforce via CI (hard gate on the health check)
4. Status quo plus documentation fixes only

## Decision Outcome
Chosen option: "Keep finalize in `grimoire-apply`; `/grimoire:pr` is the enforcing gate", because it preserves one definition home while adding enforcement at the moment drift enters — the PR — and hardening apply's own finalize language covers the other entry point (sessions ending at "tests green").

Mechanics: `grimoire-pr`'s prerequisites invert (change folder must exist; tasks complete or explicitly deferred; work committed). Its workflow: gather artifacts → run the per-change health check (`skills/references/health-check.md` §A — blockers stop the PR, warnings go into the description) → if the folder still exists, execute finalization exactly per `grimoire-apply` §7 (statuses, deferred tasks to the debt register in the existing refactor-register format, docs refresh, folder removal, `Change:`-trailer commit) → generate the description by shelling out to the existing `grimoire pr` CLI (one generator; the skill stops hand-composing a duplicate) → create the PR. Repo-wide drift checking integrates into the existing `grimoire health` command — one command, one report: the mechanical checks (stale change folders, unproven register rows, terminal/referenced ADRs, broken doc links, archive trees, trailer coverage) become a spec-drift metric in `src/core/health.ts` alongside the code metrics; judgment checks (ADR non-obvious bar, exemption justification) stay agent-run per `health-check.md`, which marks every row `mechanical` or `judgment`. `grimoire-discover` gains a Health phase that runs `grimoire health` plus the judgment rows and reports — report-only, no separate report file, no auto-fix. `AGENTS.md` states the workflow invariant — never `gh pr create` while `.grimoire/changes/` has an active change — plus the ADR bar and the proven-only constraints rule; health-check rows cite those rules rather than restating them. All checks are expressed against configured tools (`config.tools.bdd_test`, configured `checks:`), never a specific ecosystem.

### Consequences
- Good: finalization keeps one home; the gate makes skipping it visible instead of silent.
- Good: one health-check definition serves both the PR gate and the drift report; one "health" surface (`grimoire health`) avoids a second same-named report.
- Good: the description generator gets one home (CLI); the skill becomes its caller.
- Bad: enforcement is instruction-level — a determined direct `gh pr create` still bypasses it; CI enforcement deliberately deferred.
- Bad: `grimoire-pr` reads another skill's section (`grimoire-apply` §7) — a cross-skill dependency to keep in sync.

### Quality Attributes

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| Consistency | Every merged change's id appears in a `Change:` trailer on main | `git log main --format="%(trailers:key=Change,valueonly)"` spot check |
| Safety | Health checks report; the only mutation is per-change finalize with user-visible output | review of skill text |
