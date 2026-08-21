---
status: draft
change-id: fix-pr-finalize-add-health-check
kind: refactor
---

# fix-pr-finalize-add-health-check — draft

**Date:** 2026-08-21 · **Provenance:** `notes/grimoire-health-check-spec.md` (user-authored spec from the bake audit, 2026-08-21)

## At a glance

Target shape of the PR stage:

```
/grimoire:pr (skill — the finalization GATE; definition stays in apply §7)
  1 select change        (.grimoire/changes/ must EXIST — prerequisite inverted)
  2 gather artifacts     (manifest, tasks, features, decisions — before deletion)
  3 health check         (per-change scope, skills/references/health-check.md §A)
       blockers → stop, emit fix list        warnings → into PR description
  4 ensure finalized     (folder still present → execute grimoire-apply §7:
                          statuses, deferred tasks → debt register, docs refresh,
                          folder removal, commit w/ Change: trailer)
  5 generate description (shell out to `grimoire pr` CLI — one generator)
  6 create PR            (`grimoire pr --create` / gh; never invoked directly
                          while a change folder exists — AGENTS invariant)

/grimoire:discover
  ...existing phases... → NEW Health phase (repo-wide scope, health-check.md §B)
       → drift report: console + .grimoire/docs/health.md (overwritten; report-only)
```

## Why

The bake audit (2026-08-21) found finalization never happens in practice: 16 stale change
folders, 40+ trivial/stale ADRs, 35 constraint rows citing tests that don't exist, a
21-folder archive tree, and only 5 of the last 40 commits carrying a `Change:` trailer.
Root causes are in this package's artifacts (fix here, distribute via `grimoire update`):

Solved when: `/grimoire:pr` on a complete change runs the health check, finalizes, and
opens a traceable PR; on an incomplete change it stops with a blocker list; and
`/grimoire:discover` reports repo drift without editing anything.

Non-goals:
- Auto-fixing drift — both scopes report; only per-change blockers stop the PR. Deletions
  and cleanups need explicit user approval.
- Retroactive cleanup of bake/kiwi-dev/ricky — separate follow-up work in those repos.
- CI enforcement of the health check — report/skill-level only for now.

## Current state

- **The contradiction** — `skills/grimoire-pr/SKILL.md:25` (Prerequisites: "Change has been
  finalized: `.grimoire/changes/<change-id>/` is removed") vs `:32` (Workflow step 1: "List
  active changes in `.grimoire/changes/`"). Followed literally the skill can never run.
- **CLI reality differs from the note's premise 1**: `grimoire pr` EXISTS
  (`src/commands/pr.ts:4`, registered `src/cli/program.ts:44`, since v0.1.0) — it generates
  a description from the change folder, so it *requires the folder present*, sharpening the
  same contradiction. It performs no finalization.
- **Finalization currently has a different owner**: `skills/grimoire-apply/SKILL.md` §7
  "Finalize" (~line 326) — status flips, schema delta, overview refresh, learnings
  reconciliation, folder removal. The note assigns finalization to grimoire-pr; two owners
  would violate one-right-way. (Merge interaction: branch `feat/add-mkdocs-spec-site`
  edits this same §7 region — expect a conflict to resolve at merge.)
- **The shadowing** — `AGENTS.md:169` names the last stage "**PR** (`grimoire pr`)"; nothing
  stops `gh pr create` directly, which is the observed default path.
- **Existing assets to reuse**: `skills/references/` is the shared-reference home
  (health-check.md is new there); `.grimoire/docs/debt-register.yml` already has a format
  in this repo (id/category/severity/location/title/detail — see
  `skills/references/refactor-register-format.md`); `grimoire-discover` SKILL has clear
  phase structure to append a Health phase after (§5/§5.5).

Gaps (severity-ranked): (1) no finalization owner in practice → audit-trail collapse;
(2) health/drift invisible until an audit; (3) skill routing loses to the direct path.

## Decisions

| #  | Decision (Y-statement) | Why (because…) |
|----|----------|-----|
| D1 | In the context of the PR stage, facing a self-contradictory skill and finalization that never runs in practice, chose keeping the finalize definition in `grimoire-apply` §7 with `/grimoire:pr` as the enforcing gate — pr gathers artifacts, runs the health check, and if the change folder still exists executes finalization per apply §7 before describing/creating — over moving ownership to pr, accepting that pr must read apply's §7. | One definition home (apply §7) per user; consistency comes from the gate: no PR without finalize, and the AGENTS invariant (D3) closes the direct-path bypass. Prerequisites inverted: folder exists, tasks complete-or-deferred, work committed. |
| D6 | In the context of PR description generation, facing the skill hand-composing markdown that duplicates `generatePr` (`src/core/pr.ts:27`), chose the skill shelling out to the existing `grimoire pr` CLI over parallel composition, accepting CLI output as the description shape. | One description generator (DRY); also resolves the "CLI exists but never runs" confusion — the skill becomes its caller. |
| D7 | In the context of finalize never running, facing sessions that end at "tests green", chose hardening `grimoire-apply`'s Done/finalize language (finalize is part of apply, not optional) alongside the pr gate, over relying on the gate alone, accepting doc-level enforcement. | Defense in depth at the two moments drift enters: end of apply and PR creation. |
| D2 | In the context of health checking, facing two consumers (pr, discover), chose one shared definition file `skills/references/health-check.md` with two scopes (per-change blockers §A, repo-wide drift report §B) over per-skill checklists, accepting an indirection. | One source, two citations — DRY; the scopes share rules (ADR bar, proven-only register, no artifact refs in comments). |
| D3 | In the context of the direct-path shadowing, chose an AGENTS.md workflow invariant ("never `gh pr create` while `.grimoire/changes/` has an active change — route through `/grimoire:pr`") plus a routing-strength `description:` on the skill, over hooks/hard enforcement, accepting that a determined bypass still works. | Instruction-level fix matches the instruction-level cause; hard enforcement is a non-goal for now. |
| D4 | In the context of deferred work at finalize, chose logging open tasks to `.grimoire/docs/debt-register.yml` over dropping them with the change folder, accepting register growth. | Deferrals survive the folder deletion; the register is the existing home for known debt. |
| D5 | In the context of the drift report, facing a name/surface collision with the existing `grimoire health` command, chose integrating the mechanical repo-wide drift checks INTO `grimoire health` (one command, one integrated report: code metrics + spec drift; no separate `health.md` file) over a discover-owned report file, accepting that judgment checks (ADR bar, exemption review) stay agent-run via health-check.md. Report-only, no auto-fix. | User: "this is overall repo health. 1 command, 1 integrated report." `src/core/health.ts` is already metric-based (Metric[] + score, existing DriftItem concept) — a spec-drift metric slots in; two same-named health surfaces would confuse routing. |

## Decided / Open

**Decided:**
- `/grimoire:pr` performs finalization; prerequisites inverted (folder must exist; tasks complete or explicitly deferred; work committed on a feature branch) (D1).
- One health-check definition, two scopes, at `skills/references/health-check.md` (D2) — per-change checks 2A#1–7 and repo-wide checks 2B#1–8 as tabled in the note.
- AGENTS.md: stage reference becomes `/grimoire:pr`; new bypass-prevention invariant; stronger skill `description:` frontmatter (D3).
- Deferred tasks → debt register at finalize (D4).
- Drift reporting integrates into `grimoire health` — one command, one report; mechanical §B checks implemented in `src/core/health.ts` as a spec-drift metric; judgment checks agent-run; report-only (D5, revised post-review per user).
- grimoire-discover gains a Health phase (runs `grimoire health`, then the judgment rows from health-check.md §B) + triggers + onward-routing lines; never auto-fixes.
- Post-review: health-check.md rows carry a `mechanical`/`judgment` column; acceptance-walkthrough task is checked during its own `/grimoire:pr` run (review suggestions 2–3). Distribution-to-consumers timing left as-is per user (suggestion 1 declined).

**Open:**
- ~~Q1 (finalize ownership handoff)~~ RESOLVED: finalize stays in apply §7; pr is the gate and executes §7 when the folder still exists; apply's Done language hardened (D1, D7). The spec-site branch's `grimoire docs` step stays inside apply §7 (merge conflict to resolve there).
- ~~Q2 (CLI)~~ RESOLVED: keep `grimoire pr` CLI; the skill shells out to it instead of hand-composing (D6). §1d `grimoire finalize` CLI stays out of scope (deferred → Cut).
- ~~Q3 (ecosystem-generality)~~ RESOLVED: remove bake-specific items — 2A#6 becomes "configured BDD runner reports no undefined steps (`config.tools.bdd_test`)"; 2B#7 becomes "configured `checks:` gates pass; documented exemptions still justified".
- ~~Q4 (debt-register schema)~~ RESOLVED: existing grimoire refactor-register format (`skills/references/refactor-register-format.md`); deferral entries use `category: deferred-task` with the source change-id.
- ~~Q5 (policy homes)~~ RESOLVED: both — AGENTS.md states the ADR-bar and proven-only-register rules (normative home); health-check.md rows cite them as check criteria.

## Cut / deferred

| Cut | What it was | Why cut | Re-add when |
|-----|-------------|---------|-------------|
| CI enforcement | Health check as a CI gate | Report/skill-level first | Checks prove stable and low-noise |
| `grimoire finalize` CLI (note §1d) | Mechanical finalize as a CLI command | Keep CLI surface unchanged this change; skill-level fix first | Skill fix proves insufficient or CI needs it |
| Retroactive cleanups | Fixing bake/kiwi-dev/ricky drift | Per-repo follow-up work | After `grimoire update` distributes this |
