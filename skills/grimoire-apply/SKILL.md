---
name: grimoire-apply
description: Implement tasks from a planned grimoire change, test-first at the right level (BDD scenario, unit-invariant, or characterization). Use when tasks.md exists and is ready for implementation.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-apply

Implement tasks from a planned grimoire change using **test-first discipline at the right level**: write the failing test first, then the production code that makes it pass. A task is not complete until its test passes.

**Red-green is the discipline; the test vehicle matches the artifact the task came from** (set by `grimoire-plan` as each task's `verify:` tag):

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
- **Implementation lessons:** Record one implementation lesson only when the correction changes remaining work. Update only affected unchecked tasks. Rerun affected tactical tests. Do not add a checkpoint, report, approval, persona rerun, or plan-wide reconciliation.
- **Discovered facts:** stage durable project facts with their authoritative destination. Reconcile them during finalization. Never write them into `AGENTS.md`.

User direction may correct implementation mechanics. Apply the correction immediately without evaluating it against completed task prose. An agent that suspects a detail is wrong asks the user before changing direction. Existing operation permission gates remain unchanged.

### Stuck Detection and Circuit Breakers

Track failed attempts per task. Attempt one uses the direct planned approach. Before attempts two or three, read failure-mode notes and choose a fundamentally different approach. After three failed attempts, mark the task blocked, report all approaches and the persistent error, then stop for user direction. Never weaken or delete a test to force green.

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

### 5. Implement Tasks
Work through `tasks.md` sequentially. Read the task's exact tactical red-green command. Every task follows the same cycle: test → red → code → green → next. The test vehicle follows the task's `verify:` tag.

**For each task:**
1. Announce which task you're working on
   - Read the task's `verify:` tag — it decides the test vehicle. `scenario` → write/extend step definitions for the named scenario. `unit-invariant` → write a unit/integration test asserting the constraint. `characterization` → write a unit test pinning current/intended behavior. If a `unit-invariant` task has no matching constraint in `.grimoire/docs/constraints.md`, STOP and flag — don't invent a scenario to fill the gap.
   - **Pattern brief** (before writing anything): classify code type → `search_graph` for 3–5 peers (excluding last 60 days) → `get_code_snippet` → extract modal pattern across the four critical seams (error handling, dependency access, abstraction depth, return shape) → write a 5–8 rule brief. Skip if graph not indexed or < 3 peers. Full instructions in `../references/pattern-guard.md`.
2. Write the test FIRST, at the task's level (step definitions for `scenario`; unit/integration test for `unit-invariant`/`characterization`). **Generate test data, don't ask for it and don't hand-invent it** — build records through the project's data factory / property-based tool (`../references/testing-contracts.md` §Test Data Generation; detect it from `config.tools` / existing test imports), overriding only the fields this case pins. AI-authored literal data is a last resort, only when the user explicitly asked for it or no factory exists and a specific crafted value is needed — and note why when you do.
3. Run that command before production changes. Red is proven only when the selected test fails because the requested behavior is absent. Collection, import, fixture, syntax, and infrastructure failures do not prove red. Diagnose those failures before continuing.
4. If the test passes immediately, STOP. The test is broken — it is not testing missing behavior. Fix it so a real assertion fails without production code. Common causes:
   - Empty step definition body (passes by default)
   - Assertion against a mock/fixture that already satisfies the condition
   - Step wired to wrong function or missing the actual check
   - Overly broad assertion that matches anything
5. Once confirmed red: write the production code to make it pass. **While writing — not after — apply the rules in `../references/code-quality.md` and the pattern brief from step 1. Do not write the slop version first and clean up later.** Inline rules:
   - **Reuse first — search before write.** Before writing any new function or class, run two searches: `search_graph(semantic_query=["<concept>", "<verb>", "<domain_noun>"])` to find it by concept, then `search_graph(name_pattern="<likely_prefix_or_suffix>")` to find it by name. If either returns something that does the job → call it. If something almost fits → use it directly; don't generalize for a hypothetical second caller. Write new code only when both searches return nothing usable. No one-line wrappers. No re-implementations. Full instructions: `../references/pattern-guard.md` Step 1b.
   - **Trust your callers.** No `if x is None` / `isinstance` / `try-except` guards inside the trust boundary. Validate at edges (user input, external APIs, file/network) only.
   - **Names reveal intent.** No `data` / `result` / `temp` / `info` / `obj` when a specific name fits. Booleans read as yes/no questions (`is_expired`, `has_admin_role`).
   - **Branching budget ~7.** If a function has more `if` / `else` / `case` / `&&` than that, split or drop dead guards.
   - **Function size ~30 lines.** One job per function. If the name needs "and", split.
   - **No premature abstraction (YAGNI).** Three near-identical copies is fine. No new `BaseX` / factory / strategy / config object for a single caller.
   - **Guardrails — the floor YAGNI never cuts below.** Simplicity stops at safety. Never drop, in the name of less code: input validation at a trust boundary, error handling that prevents data loss, a security control (authn/authz, output escaping, secret handling — see `../references/security-compliance.md`), an accessibility basic, or anything the task explicitly requested. Edge validation (above) is *required* code, not defensive slop — the trust-your-callers rule governs the interior only. Non-trivial logic (a branch, loop, parser, money/security path) leaves one runnable check behind (`../references/testing-contracts.md`); a lazy version without its check is unfinished, not done.
   - **Comments: terse, self-contained, no essays** (`../references/code-quality.md` §7). Default to none; add only a one-line non-obvious *why*. Terse voice — drop "this function", filler, restated types. **Self-contained:** never name an external artifact that moves independently — no feature/scenario/`.feature`, MADR/ADR number, change-id, ticket/PR, test name, or tag code (`LOG-OBS-003`) in a comment; describe the behavior, not where it's specced. **No paragraphs:** summary is 1–2 lines, then the `comment_style` params if the project requires them — no prose block before them. No comments restating the code (`# loop over users`). If removing it wouldn't confuse a future reader, don't write it.
6. Run the same command after production changes. It must pass before task completion.
7. If still red, fix the production code (not the test)
8. **Hallucination check:** Before running tests, verify every external function/method your new code calls actually exists in the graph: `search_graph(name_pattern="<name>")` for each. If not found: find the correct function or stop and flag to user. Do not run tests against calls to non-existent functions. (Full instructions in `../references/pattern-guard.md` Step 6.)
9. **Test quality check:** Before marking done, verify your step definitions have strong assertions:
   - Every Then step has a specific `assert` or `expect` with an exact expected value (not `assert True`, not `toBeDefined()`)
   - No empty function bodies (`pass`, `...`, or no-op)
   - Assertions check behavior, not just types or existence — "response status is 302 and redirect URL is /dashboard/" not "response is not None"
   - If you wrote a test that would pass against a null/trivial implementation, strengthen it
10. **Code quality check:** Walk the seven-point checklist in `../references/code-quality.md` against every file you changed. Any fail → fix code, re-run tests, re-check. Do not mark `[x]` while a check fails.
11. **Reconcile task working memory:** prune this task's failure-mode notes from `learnings.md` — it's green, they've served their purpose. If you learned a durable project fact while implementing (a build flag, a convention, an undocumented contract, an architectural constraint), append it to the **Discovered facts** section with its destination home — don't write it into `AGENTS.md` and don't leave it only in context.
12. Mark complete: `- [ ]` → `- [x]` as soon as the tactical command passes.
13. Record the red-green result and current checkbox state in the section handoff, then move to the next task.

**This is strict red-green BDD.** A test that has never been red has never proven it can catch a failure. The red step is NOT a formality — it is the proof that the test works. If you skip it or the test passes immediately, you have a false positive that provides zero safety.

**User-directed test corrections:** When the user corrects an implementation-specific test expectation, update the test before changing production code. Run the corrected test against the current production code and confirm it fails. Only then change production code to make the corrected test pass.

**Never game the gate (reward-hack guard).** When a test won't pass, fix the production code unless the user corrected its implementation-specific expectation. An agent must never weaken or delete a test without explicit user direction. Deleting a test, loosening an assertion to match wrong output, narrowing what it checks, or skipping/`xfail`-ing it to get a green run is **stop-and-flag**, not a valid completion. A user-directed expectation correction authorizes only that correction and still requires red-green proof. The gate is the convergence signal; gaming it produces plausible-wrong code faster.

**Step definition rules:**
- Organize by domain concept, not by feature file
- Shared steps go in the project's common step location (check existing test setup)
- Step definitions are the translation layer between Gherkin and code
- Keep them thin — delegate to helper/support code
- Every Given/When/Then step in a proposed `.feature` file MUST have a corresponding step definition

**Architecture tasks:**
- Follow the decision record's chosen option
- Implement consequences noted in the ADR
- If the ADR has a Confirmation section, write a test or check that validates it

### 6. Verify
Invoke `grimoire-verify` once after every implementation activity is complete. Review and final configured suites belong to that procedure. They are not task checkboxes or separate apply gates.

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

**Before writing code**, read all three:
- `../references/pattern-guard.md` — run before each task: (1) classify code type, (1b) reuse discovery — two `search_graph` calls (semantic_query by concept + name_pattern by likely name) to find existing code to call instead of writing new code, (2) find 3–5 peers, extract modal pattern across four seams (error handling, dependency, abstraction depth, return shape), write a pattern brief. Apply the brief while writing. Run hallucination check after writing (verify called functions exist in graph). Skip if graph not indexed.
- `../references/code-quality.md` — anti-slop rules to apply *while writing*: reuse before write, trust callers, names reveal intent, branching budget, function size, no premature abstraction, zero comments by default (only non-obvious *why*, never *what*). Includes a seven-point quality gate to run before marking each task `[x]`.
- `../references/testing-contracts.md` — verify-before-using rules (imports, packages, APIs), mocking strategy (HTTP boundary not client), fixture management, contract tests, and step definition quality checks.
- `../references/test-baseline.md` — capture which tests were already failing at change start, save to `baseline.md`, get user acceptance; verify diffs against it so only new failures count as regressions.

## Important
- **Tests are not optional.** Every task produces production code and a passing test at its declared verification level.
- **Red-green is mandatory, not aspirational.** A test must fail before it passes. If it doesn't fail, it's not a real test. Fix it before moving on.
- **Code-before-test is the most common bypass.** "I'll add the test after" / "let me see it work first" are the *Code before the test* rationalization in `../references/red-flags.md`. If you wrote code before the test, delete the code and start from red.
- **A test that always passes is worse than no test.** It gives false confidence. If you can't make a step definition fail, you don't understand what it's testing.
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
