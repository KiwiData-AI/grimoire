---
status: implementing
complexity: 3
branch: feat/fix-pr-finalize-add-health-check
design_ref: notes/grimoire-health-check-spec.md
---

# Change: PR gate enforces finalization; shared health check

## Why
Finalization never runs in consumer repos (bake audit 2026-08-21: 16 stale change folders, 40+ trivial ADRs, 35 unproven constraint rows, 5/40 commits with `Change:` trailers) because the package's own artifacts prevent it: the `grimoire-pr` skill is self-contradictory, and the direct `gh pr create` path shadows the workflow. Solved when `/grimoire:pr` on a complete change health-checks, finalizes per `grimoire-apply` §7, and opens a traceable PR; on an incomplete change it stops with a blocker list; and `/grimoire:discover` reports repo drift without editing files.

## Non-goals
- Auto-fixing drift — both scopes report; only per-change blockers stop the PR.
- Retroactive cleanup of bake/kiwi-dev/ricky — follow-up work in those repos after `grimoire update`.
- CI enforcement of the health check.
- New CLI commands (`grimoire finalize`, note §1d) — deferred; skill-level fix first. (`grimoire pr` stays as-is; the skill becomes its caller. The only CLI code change is extending `grimoire health` with the spec-drift metric.)

## Feature Changes
- **MODIFIED** `see-project-health.feature` — health additionally reports spec-process drift (stale changes, unproven register rows, stale decision references, broken doc links). Skill/reference/AGENTS edits remain feature-less: agent-followed behavior is not automatable as Gherkin.

## Scenarios Added
- `see-project-health.feature`: "Health reports spec-process drift"

## Scenarios Modified
- none

## Decisions
- **ADDED** `0039-pr-gate-enforces-finalization.md` — finalize stays in apply §7; pr is the enforcing gate; one shared health-check definition; AGENTS invariant + policy rules. (Draft D2–D7 fold in as mechanics.) Note: 0038 is claimed by the unmerged `feat/add-mkdocs-spec-site` branch — do not renumber either.

## Prior Art
The health check adopts existing grimoire mechanisms rather than new ones: the debt register and its refactor-register format (`skills/references/refactor-register-format.md`) for deferral entries; `skills/references/` as the shared-definition home (same pattern as `review-personas.md` used by three review skills); the existing `grimoire pr` CLI as the single description generator (the skill currently duplicates it by hand — that duplication is removed, not extended); git trailers (`git log --format="%(trailers:key=Change,valueonly)"`) for traceability checks. External tooling (danger-js, commitlint, CI policy engines) was considered and rejected for now: enforcement is instruction-level by design (CI enforcement is an explicit non-goal until checks prove low-noise).

## Assumptions
- Agents actually follow strengthened skill `description:` frontmatter for routing — unvalidated but on the critical path for fixing the shadowing; mitigated by the AGENTS.md invariant (two independent instruction points). Validated in practice by the acceptance walkthrough.
- `grimoire pr` CLI output is usable as-is for the skill's description step — evidence: `generatePr` (src/core/pr.ts:27) composes the same sections the skill hand-writes today.
- The bake findings generalize to other consumer repos — evidence: the root causes are in package artifacts distributed to every repo.

## Pre-Mortem
- **The pr↔apply cross-reference drifts** (apply §7 changes, pr skill's gate description goes stale) → mitigation: pr's skill text names apply §7 as the definition and repeats none of its steps.
- **Health check produces noise, gets ignored** → mitigation: per-change blockers are few and mechanical (7 checks); repo-wide report is severity-bucketed (`fix-now`/`review`/`info`); CI escalation deferred until proven low-noise.
- **Merge conflict with `feat/add-mkdocs-spec-site`** (both branches edit apply's finalize region and AGENTS/README areas) → accepted: resolve at merge; this branch's §7 edit is additive language, the other adds a docs-build step — both survive.
- **Direct `gh pr create` bypass continues** → accepted for now: instruction-level enforcement is the decision (ADR-0039); CI gate is the recorded escalation path.
