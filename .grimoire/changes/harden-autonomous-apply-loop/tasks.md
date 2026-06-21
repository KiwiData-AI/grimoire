# Tasks: harden-autonomous-apply-loop

> **Change**: Instruction-level hardening of autonomous `grimoire-apply` — ephemeral two-lifecycle `learnings.md`, cross-section thrash detection, circuit breaker, reward-hack guard.
> **Features**: none (internal process change, routed off Gherkin).
> **Decisions**: 0035-harden-autonomous-apply-loop (proposed → accept at finalize).
> **Constraints**: 2 added (ceiling halt; no test-weakening) — both `TODO: unit-invariant`, instruction-only in v1.
> **Test command**: `npx vitest run` (full); `npm run test:bdd`; `npx grimoire validate` (skill/spec structure).
> **Complexity**: 3 (Moderate).
> **Agents**: thinking=claude, coding=claude.

## Verification note (read first)

This change edits markdown only — skill instructions, a template, `AGENTS.md`, a decision, constraint rows. There is **no runtime code**, so the standard per-task red-green cycle does not apply: there is nothing to make fail then pass. Verification for every task is **review against the design in `draft.md` + `0035`** plus the change-wide gate (`§6`): `npx grimoire validate` passes and the existing check suite stays green (no regression). The two constraints are carried as `TODO: unit-invariant` for the future enforcement follow-up — they are **not** implemented as code here. Do not invent unit tests for prose; do not add code to "make the breaker testable" (that is the deferred Option 2, explicitly out of scope per 0035).

## Reuse / source

- The learnings-file edit set was pre-drafted this session (failure-mode notes + discovered facts). Reuse it rather than re-deriving — it maps 1:1 to §1–§4 below.
- `templates/learnings.md` follows the per-change template pattern of `templates/draft.md` / `templates/manifest.md` — created per-change by the skill, **not** added to `TEMPLATE_FILES` in `src/core/shared-setup.ts` (confirmed: that list is curated, no registration test breaks).
- `learnings.md` shares the ephemeral lifecycle of `tasks.md` — created in `.grimoire/changes/<id>/`, removed at finalize.

---

## 1. Learnings template
<!-- context:
  - templates/draft.md
  - templates/manifest.md
  - .grimoire/changes/harden-autonomous-apply-loop/draft.md   (Sketches § + D4/D4a)
-->

- [x] 1.1 Create `templates/learnings.md` — `verify: characterization`
      - Header note: ephemeral, lives in `.grimoire/changes/<change-id>/`, removed at finalize; re-read at every section start and before every retry.
      - **## Failure-mode notes** — transient; one line per dead end; read before any retry; pruned the moment a task goes green; never promoted. Format `- <task-id> · tried <approach> · failed: <observed error / why>`, with one example.
      - **## Discovered facts** — durable; staged with destination home; reconciled into that one home at finalize then cleared; never `AGENTS.md`. Format `- fact: <what> → home: <area doc | decision | constraint | schema | feature>`, with one example.

## 2. Apply skill — learnings working memory
<!-- context:
  - skills/grimoire-apply/SKILL.md
  - templates/learnings.md   (created in §1)
-->

- [x] 2.1 In the file-layout paragraph (anchor: "The change folder holds only ephemeral process scaffolding (`manifest.md`, `tasks.md`)"), add `learnings.md` to the ephemeral list. — `verify: characterization`
- [x] 2.2 Insert a new subsection **"Working Memory: `learnings.md`"** after the "Both modes" paragraph (before "### Stuck Detection & Recovery"): two sections / two lifecycles; subagents and fresh sessions read+append it like `tasks.md` (shared disk state, not context memory); create it from `templates/learnings.md` on first need. — `verify: characterization`

## 3. Apply skill — thrash detection + circuit breaker
<!-- context:
  - skills/grimoire-apply/SKILL.md   (§ "Stuck Detection & Recovery", § "Session Management")
  - AGENTS.md   (§ Anti-Loop Protocol — keep consistent, do not duplicate)
  - .grimoire/decisions/0035-harden-autonomous-apply-loop.md
-->

- [x] 3.1 In "Stuck Detection & Recovery", make the attempt ladder learnings-aware: before any attempt past the first, read the task's failure-mode notes and do not repeat a recorded dead end; append a failure-mode note after attempts 1 and 2 before trying the next approach. Update the after-3-attempts step so the `<!-- BLOCKED -->` comment is a summary (full trail already in failure-mode notes). — `verify: characterization`
- [x] 3.2 Add a **circuit breaker** subsection for autonomous mode (instruction-only): caps under `llm.coding.limits` in `config.yaml` — `max_sections_without_checkpoint` (default 5), `consecutive_blocked` (default 2), `max_cost_usd` (null/opt-in), `max_wallclock_min` (null/opt-in). On trip: stop, state the trip reason + diagnosis, hand to user. State plainly that cost/wall-clock are soft self-reported caps in v1 (not harness-enforced). — `verify: unit-invariant` *(deferred — constraint row carries `TODO`; no code in v1)*
- [x] 3.3 Add **cross-section thrash detection** (parent orchestrator, between sections): halt when the last two sections both ended BLOCKED, or when a section's failure-mode error class repeats the prior section's. Wire it as the breaker's trigger, not a local retry. — `verify: unit-invariant` *(deferred — see 3.2)*
- [x] 3.4 Add the **reward-hack guard**: during apply, weakening or deleting a test to make the gate pass is stop-and-flag, not a valid green. Place near the red-green rules in §5. — `verify: unit-invariant` *(deferred — constraint row carries `TODO`)*
- [x] 3.5 Add **"one task sized to one context"** framing where Session Management discusses fresh context: stateful within a task, reset between tasks; mid-task context overflow is a smell → split the spec, not a normal mode. Do not introduce a stateless shell-loop driver. — `verify: characterization`

## 4. Apply skill — reconcile steps + subagent prompt
<!-- context:
  - skills/grimoire-apply/SKILL.md   (§5 task loop, § Session Management subagent prompt, §7 Finalize)
  - templates/learnings.md
-->

- [x] 4.1 Add a task-loop step (between current "Code quality check" and "Mark complete", renumber following steps): **Reconcile working memory** — prune this task's failure-mode notes on green; append any durable project fact to Discovered facts with its home (never `AGENTS.md`, never leave it only in context). — `verify: characterization`
- [x] 4.2 Extend the subagent prompt block to instruct: use `learnings.md` as working memory — read failure-mode notes before retrying, append after a failed attempt, prune on green, append durable facts with their home. — `verify: characterization`
- [x] 4.3 Add a Finalize step (before change-directory removal): reconcile each **Discovered fact** into the home it names (area doc / decision / constraint / schema / feature), confirm routing with the user (correctable), drop stale ones; failure-mode notes are discarded, not promoted; `AGENTS.md` is never the destination. Add `learnings.md` to the ephemeral-removal list in the removal step. — `verify: characterization`

## 5. AGENTS.md consistency
<!-- context:
  - AGENTS.md   (§ Anti-Loop Protocol, Directory Structure block, change-folder invariant note)
  - skills/grimoire-apply/SKILL.md
-->

- [x] 5.1 Update the change-folder invariant note to include the apply-maintained `learnings.md` alongside manifest + tasks. — `verify: characterization`
- [x] 5.2 Add `learnings.md` to the `changes/<change-id>/` block in Directory Structure (one-line comment: "apply working memory: failure-mode notes + discovered facts"). — `verify: characterization`
- [x] 5.3 If the Anti-Loop Protocol warrants it, add a one-line pointer to the apply breaker/thrash detection (cross-reference, do not duplicate the rules — DRY). — `verify: characterization`

## 6. Verify + finalize-readiness
<!-- context:
  - .grimoire/decisions/0035-harden-autonomous-apply-loop.md
  - .grimoire/docs/constraints.md
-->

- [x] 6.1 Run `npx grimoire validate` — skill/spec structure passes. — `verify: characterization`
- [x] 6.2 Run the check gate (`npx vitest run`, `npm run test:bdd`, lint) — confirm green, no regression vs baseline (markdown-only change should not move any test). — `verify: characterization`
- [x] 6.3a Finalize (non-destructive): flip 0035 `proposed → accepted` with date; run `grimoire docs` to refresh `OVERVIEW.md`. — `verify: characterization`
- [ ] 6.3b Finalize (destructive — DEFERRED to user): remove the change folder (manifest + tasks + learnings + draft). Blocked: nothing is committed yet, so deleting now would permanently lose the scaffolding (git can't preserve an uncommitted file). Do this only after a commit records the scaffolding in history.
<!-- BLOCKED: folder-removal deferred — must commit scaffolding first or it's lost (not in git). -->

