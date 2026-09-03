---
name: grimoire-apply
description: Implement understood planned work with tests written first, one section confirmation, and one final verification.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-apply

Implement understood tasks from a planned change. Use `../references/testing-lifecycle.md` for spike routing, test ordering, section confirmation, and final verification.

For planned delivery, write all known section tests before production code. Do not run tests only to observe red. Mark every covered task complete together after confirmation passes or is deferred.

The test vehicle matches the source artifact:

| `verify:` | Task came from | Test vehicle |
|-----------|----------------|--------------|
| `scenario` | a `.feature` (actor-observable behavior) | Gherkin scenario + step definitions |
| `unit-invariant` | the constraints register (security/NFR/observability) | unit/integration test asserting the invariant |
| `characterization` | internal change / refactor (no spec) | unit / characterization test |

Do NOT write a `.feature` scenario for a `unit-invariant` or `characterization` task — forcing Gherkin where a unit test is correct is the antipattern that fills feature files with slop. One right way: behavior → scenario, everything else → unit test.

**Artifacts are edited live on the feature branch.** Features, decisions, constraints, and schema are real files in `features/`, `.grimoire/decisions/`, `.grimoire/docs/`. There is no copy-into-change-folder and no promote step. The ordinary Git index is the staging area. The change folder holds ephemeral process scaffolding such as `draft.md`, `manifest.md`, `tasks.md`, `baseline.md`, and `learnings.md`.

## CRITICAL: Two Rules That Must Not Be Broken

### 1. Do Not Re-Plan

**`tasks.md` IS the plan. Do not enter plan mode. Do not create your own plan. Do not reorganize, re-derive, or "think through" the tasks before starting.**

The approved section outcome and source artifacts remain authoritative; implementation mechanics are correctable details. Apply user-directed active-section corrections without evaluating the guidance or updating planning artifacts after each correction. An agent must ask for user direction before changing implementation direction; agents never create active-section drift autonomously.

### 2. Do Not Implement All Tasks In One Context

**Spawn a fresh subagent (or start a fresh session) for each task section.** The parent/orchestrator reads `tasks.md` and delegates — it does NOT write code itself. Context degrades after 3-4 tasks and the LLM starts making mistakes based on stale file contents. See "Session Management" below for the exact workflow.

The plan was already created in the plan stage, reviewed by the user, and approved. Your job is to EXECUTE it, not to re-evaluate it. Read `tasks.md`, find the first unchecked task, and start working.

If you suspect a task detail is wrong, ask the user before changing implementation direction. Apply a user-directed correction inside the active section. Flag genuine execution impossibility. Do not silently re-plan, skip, or reorder tasks.

This applies to all LLMs: Claude, Codex, Cursor, Copilot, etc. The task list is the authority.

## Triggers
- User wants to implement a planned grimoire change
- User asks to apply, implement, or build a grimoire change
- Loose match: "apply", "implement", "build" with a change reference

## Routing
- No tasks.md exists → `grimoire-plan` first
- Behavior, a contract, a root cause, a reliable reproduction, or implementation direction is unknown → `grimoire-spike`
- Agent suspects a task detail is wrong → ask the user before changing direction
- User directs an active-section correction → apply it without mid-section plan maintenance
- Task is genuinely impossible → flag the blocker; do NOT silently re-plan or skip
- Implementation reveals the spec is wrong → STOP. Go back to `grimoire-draft`.
- Fix is needed (not a planned change) → `grimoire-bug`

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with:
  - `manifest.md`
  - `tasks.md` (from plan stage, each task carrying a `verify:` tag)
- Feature, constraint, and decision artifacts are optional.

## Workflow

### 1. Select Change
- List active changes in `.grimoire/changes/` that have `tasks.md`
- If multiple, ask user which one to apply
- If only one, confirm it
- Read `tasks.md` and find the first unchecked `- [ ]` task — that's where you start
- Skip any tasks already marked `- [x]` (resume from where a previous session left off)

### 2. Set Up Change

Before dispatching any section, ensure the change is on its feature branch:

```
git checkout -b <type>/<change-id>
```

Where `<type>` is `feat`, `fix`, `refactor`, or `chore` based on the change. If a branch already exists (`grimoire-branch-guard` or `grimoire-draft` usually created it), switch to it. Update the manifest's `branch:` field with the branch name.

The branch links Git history to the change through the `Change: <change-id>` commit trailer. The branch provides isolation, and the ordinary Git index provides staging.

Run every configured test suite once before code changes and record `baseline.md`. Present any pre-existing failures to the user and get acceptance before proceeding. Skippable when no test command is configured or the user opts out. Record the skip. Full protocol: `../references/test-baseline.md`.

The point: a failure is "pre-existing" only if it is in `baseline.md`. This replaces end-of-run "that's a pre-existing failure" surprises with a start-of-run acceptance.

> **No promote.** Feature files, decisions, and constraints were drafted directly into their live locations (`features/`, `.grimoire/decisions/`, `.grimoire/docs/constraints.md`) on this branch. BDD runners already discover the scenarios from `features/`. Do not copy anything out of `.grimoire/changes/` — that folder holds only ephemeral scaffolding such as `draft.md`, `manifest.md`, `tasks.md`, `baseline.md`, and `learnings.md`.

### 3. Dispatch Each Substantial Section

Validate every section dependency before dispatch. Require one `depends-on` comment per section. Dependencies name only existing earlier sections and form no cycle. Confirm every dependency section is complete before starting the next section. Report all dependency errors together and stop without rewriting the approved plan.

Start a fresh implementation context for each substantial section. The section agent loads its context block and implements every unchecked task directly. Task checkboxes are the resume state. Write one `<!-- SESSION: ... -->` handoff under the last task before leaving the section.

Read each activity's review marker before editing:

- A `structure-before` activity pauses once for production-shape approval, then proceeds with direct autonomous implementation.
- Without an approval marker, perform that pause before editing production code.
- Record `<!-- review-status: approved -->` immediately below the activity's review marker after approval.
- When that approval marker already exists, skip the structure review on resume.
- After approval, proceed with direct autonomous implementation.
- A `slice-after` activity proceeds with direct autonomous implementation and no intermediate gate.

The `structure-before` review covers ownership, files, data relationships, constraints, indexes, nullability, public signatures, dependencies, transactions, queues, retries, external boundaries, reused patterns, and material alternatives. Approval applies to the activity's shape, not every file edit.

Optional per-file review is harness behavior. It does not create Grimoire metadata, checkpoints, or task state.

### Working Memory: `learnings.md`

Create `.grimoire/changes/<change-id>/learnings.md` from `templates/learnings.md` when needed. It remains ephemeral and is removed at finalization.

- **Failure-mode notes:** record each failed approach before a retry. Read these notes before another attempt. Prune a task's notes when it turns green.
- **Implementation lessons:** Record one implementation lesson only when remaining work changes. Update only affected unchecked tasks. Preserve the section confirmation boundary. Do not add a checkpoint, report, approval, persona rerun, or plan-wide reconciliation.
- **Spike lessons:** Record question-driven evidence using the `S<n>` format from `../references/testing-lifecycle.md`.
- **Discovered facts:** stage durable project facts with their authoritative destination. Reconcile them during finalization. Never write them into `AGENTS.md`.

User direction may correct implementation mechanics. Apply the correction immediately without evaluating it against completed task prose. An agent that suspects a detail is wrong asks the user before changing direction. Existing operation permission gates remain unchanged.

### Stuck Detection and Circuit Breakers

Track failed attempts per problem. Attempt one uses the direct planned approach. Before attempts two or three, read failure-mode notes and choose a fundamentally different approach. After three failed delivery attempts, stop delivery and create a findings-only spike. Present all approaches, the persistent error, and the unresolved question. Require human direction before attempt four. Never weaken or delete a test to force confirmation.

Between sections, stop when two consecutive sections are blocked or the same failure class repeats across sections. Honor configured cost and wall-clock limits as soft limits. Preserve all existing branch, permission, destructive-operation, and specification-conflict gates.

### Session Management

Start a fresh implementation context for each substantial section. One context carries the section through all its vertical tasks. Break early after three attempts on one task or when context quality degrades. Record completed checkboxes and a handoff before leaving.

### 4. Load Context

**Use the context blocks in `tasks.md`.** Each task section has a `<!-- context: ... -->` comment listing the exact files to load for that section. This was computed during planning with full codebase knowledge. Load those files — they include the relevant feature files, area docs, and source files you'll need.

**Loading order:**
1. `tasks.md` — your checklist (load once at start, find the current section)
2. Read the `<!-- context: ... -->` block for the current section
3. Load each file listed in the context block — this includes relevant `.grimoire/docs/conventions/<area>.md` files for directories touched by the diff (placement/naming guidance)
4. If a listed file doesn't exist, it may need to be created as part of the task — that's fine

**If the context window fills up** (degraded output quality, forgotten context, repeated mistakes):
1. Finish or pause the current task
2. Summarize progress in `tasks.md` (mark completed tasks, add handoff note)
3. Tell the user: "Context is getting large. I've updated tasks.md with progress. A fresh session can resume from here."

### 5. Implement Each Section

Follow `../references/testing-lifecycle.md`.

1. Announce the section. Read each activity's `verify:` tag and choose its planned test vehicle.
2. If behavior, a contract, a cause, a reliable reproduction, or direction is unknown, stop delivery and route to `grimoire-spike`.
3. Write all known section tests before production code. Do not run tests only to observe red.
4. Implement every covered activity in dependency order. Apply `../references/code-quality.md` while writing.
5. Verify imports and external calls before confirmation. Use the code graph when available and `rg` plus the actual module otherwise.
6. Check test assertions for exact outcomes, no empty bodies, and no trivial or circular assertions.
7. Run at most one planned section confirmation after all covered implementation is complete. Defer it when it requires database or container startup.
8. If confirmation fails, diagnose that observed failure. Record each failed approach before a retry and honor the three-attempt breaker.
9. Mark every covered task complete together when confirmation passes or is explicitly deferred.
10. Prune covered failure notes and record the confirmation result in the section handoff.

User-directed corrections update tests before production code when the correction changes an expected outcome. Preserve the section confirmation boundary. An agent must never weaken or delete a test without explicit user direction.

Architecture activities follow the decision record's chosen option and Confirmation criteria.

### 6. Verify
Invoke `grimoire-verify` once after all implementation sections are complete. Review and final configured suites belong to that procedure. They are not task checkboxes or separate apply gates.

Do not proceed to finalization until `grimoire-verify` reports no new failures against `baseline.md`.

### 6a. Final Staged Review

Run this procedure after finalization has removed the change folder, regenerated documentation, and staged the complete durable final state. This authorization gate does not repeat the pre-commit persona review.

1. Identify the target branch and its merge base.
2. Confirm the ordinary Git index contains every intended durable change, including any tracked change-folder deletion.
3. Present the complete merge-base-to-index path list:
   ```
   git diff --cached --name-status "$(git merge-base <target-branch> HEAD)"
   ```
   Group every listed path under `Production` or `Support`. Treat an unknown path as production until classified. Exclude nothing from approval.
4. Present the full merge-base-to-index diff without a pathspec:
   ```
   git diff --cached "$(git merge-base <target-branch> HEAD)"
   ```
5. Require explicit user approval of the complete staged path list and full merge-base-to-index diff. Approval covers both production and support paths.
6. On approval, immediately create one final commit from the reviewed index. Do not edit or restage between approval and commit. Include `Change: <change-id>` and `Final-production-review: approved` trailers.

### 7. Finalize
When all tests are green. Finalize is part of apply, not optional. A session that
ends at "tests green" without finalizing leaves the change unfinished;
`/grimoire:pr` executes this section before any PR.

1. Run the applicable active-change health checks from
   `../references/health-check.md` §A. Resolve blockers before changing durable
   finalization state.
2. Verify branch history contains at least one ordinary commit whose body has
   `Change: <change-id>`. The qualifying commit must contain durable verified
   work only and must contain no path under `.grimoire/changes/<change-id>/`. If
   no commit qualifies, stage a coherent durable verified increment without the
   change folder and create an ordinary commit through `grimoire-commit`. Stop if
   no durable verified work is available for that commit. Run the pre-cleanup
   identity check from `../references/health-check.md` §A before continuing.
3. Flip this change's proposed decisions to `accepted` and set the date.
4. Apply `data.yml` entries to `.grimoire/docs/data/schema.yml` when present.
5. Reconcile each durable fact in `learnings.md` into its named durable home.
   Discard failure-mode notes.
6. Record every deferred task in `.grimoire/docs/debt-register.yml`. Each open
   task requires an explicit deferral note and a `category: deferred_task` entry
   containing the change-id. An unexplained open task blocks finalization.
7. Remove `.grimoire/changes/<change-id>/`, including its design, manifest,
   tasks, baseline, data delta, and working-memory files.
8. Run `grimoire docs` after removal. It regenerates
   `.grimoire/docs/OVERVIEW.md` from the durable live state. When
   `tools.spec_site` is configured, the same command must regenerate and build
   the committed site successfully.
9. Stage the complete intended durable final state in the ordinary Git index.
   Include live implementation, tests, features, accepted decisions, schema,
   reconciled docs, debt register, regenerated documentation, and the
   change-folder deletion. Before staging, inspect the existing index. Every
   staged path must belong to an approved task or durable finalization step.
   Unrelated pre-staged work blocks finalization; stop and ask the user instead
   of committing, unstaging, or modifying it.
10. Run the applicable post-cleanup health checks from
   `../references/health-check.md` §A against the staged durable state. Resolve
   blockers before review.
11. Run §6a once. Present the complete staged path list and full
    merge-base-to-index diff, then obtain explicit approval of the entire index.
12. Immediately create one final commit from the reviewed index with
    `Change: <change-id>` and `Final-production-review: approved` trailers.

Use no review snapshot, digest, synthetic ref, synthetic index, review worktree,
or cleanup-only commit. The final commit contains the reviewed remaining durable
state and any tracked cleanup; it is never a separate cleanup commit.

If finalization resumes after step 6, reconstruct the intended durable state
from Git history and changed live artifacts. Continue with documentation,
staging, one review, and one final commit.

### 8. Commit

Ordinary mid-process commits are allowed whenever verified work forms a useful
unit. Each requires `Change: <change-id>` and does not require final production
review or its trailer.

Finalization creates exactly one final commit after cleanup and §6a approval.
Use `/grimoire:commit` or a manual message following `AGENTS.md` conventions:
```
feat(<change-id>): <short description>

<body if needed>

Change: <change-id>
Final-production-review: approved
Scenarios: "<scenario 1>", "<scenario 2>"
```

The required pre-cleanup ordinary commit contains durable verified work and no
ephemeral scaffolding. Do not create another commit only for change-folder
removal. Do not open a PR before finalization completes.

### 9. Summary
Present a brief summary:
- What was implemented
- Which features now pass (with test counts if available)
- Which decisions were accepted
- Any follow-up items

## References

**Before writing code**, read all five:
- `../references/testing-lifecycle.md` — authoritative mode selection, spike exits, delivery cadence, section confirmation, and final verification cadence.
- `../references/pattern-guard.md` — reuse discovery and call validation. Skip graph-specific work when the graph is unavailable.
- `../references/code-quality.md` — writing guidance for reuse, branching, naming, trust boundaries, abstractions, and comments.
- `../references/testing-contracts.md` — provider fixtures, owned orchestration stubs, test data, and assertion quality.
- `../references/test-baseline.md` — capture which tests were already failing at change start, save to `baseline.md`, get user acceptance; verify diffs against it so only new failures count as regressions.

## Important
- **Tests are not optional.** Write every known section test before planned production code.
- **Do not manufacture red.** Planned delivery does not run tests only to observe failure. Understood bug fixes retain their observed reproduction.
- **Unknown work is not delivery.** Route unresolved behavior, contracts, causes, reproductions, or directions to `grimoire-spike`.
- The feature file is the spec. If a test fails, fix the code, not the feature.
- If implementation reveals that a scenario is wrong or missing, STOP and go back to draft. Don't silently change features.
- Keep changes minimal and focused — only implement what's in tasks.md
- If blocked, flag it rather than working around it
- Commit frequently — one commit per logical task is ideal. Every commit during apply **MUST** include a `Change: <change-id>` git trailer for audit traceability. Use `/grimoire:commit` or manually add the trailer.
- Existing tests must keep passing. A grimoire change that breaks existing behavior is not complete.

## Done
When all tasks are complete, tests pass, and artifacts are finalized, the workflow is complete. A session that ends at "tests green" without finalizing leaves the change unfinished — §7 is part of apply. Present the summary and suggest:
- `grimoire-commit` to commit the changes
- `/grimoire:pr` to create the PR — it executes §7 first if the change folder is still present
