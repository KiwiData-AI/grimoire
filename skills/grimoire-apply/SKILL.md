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
- The change's live artifacts exist on the branch — at least one `.feature` (in `features/`), constraint (in `.grimoire/docs/constraints.md`), or decision record (in `.grimoire/decisions/`)

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

Before dispatching any section, run the configured suites once to record the starting state. Present any pre-existing failures to the user and get acceptance before proceeding. Write the result to `.grimoire/changes/<change-id>/baseline.md`. Skippable when no test command is configured or the user opts out. Record the skip. Full protocol: `../references/test-baseline.md`.

The point: a failure is "pre-existing" only if it is in `baseline.md`. This replaces end-of-run "that's a pre-existing failure" surprises with a start-of-run acceptance.

> **No promote.** Feature files, decisions, and constraints were drafted directly into their live locations (`features/`, `.grimoire/decisions/`, `.grimoire/docs/constraints.md`) on this branch. BDD runners already discover the scenarios from `features/`. Do not copy anything out of `.grimoire/changes/` — that folder holds only ephemeral scaffolding such as `draft.md`, `manifest.md`, `tasks.md`, `baseline.md`, and `learnings.md`.

### 3. Dispatch Each Section

Before dispatching any section, validate the complete plan. Require exactly one
`depends-on` comment on every implementation section. Validate that dependencies
name existing earlier sections, form no cycle, and match the section order.
Validate that autonomous sections contain no human approval, manual inspection,
ask-the-user, or wait tasks. An approved terminal `External acceptance` section
is not an autonomous implementation section and runs only after implementation
and verification complete.

For the next section, confirm every declared dependency section is complete;
every task in a complete dependency section is checked. Only then dispatch the
section. Treat missing dependency metadata, unknown or
forward dependencies, cycles, incomplete dependencies, or human-gate tasks in
autonomous sections as an invalid approved plan. Report every plan error together
and stop without editing, reordering, or repairing `tasks.md`. Await user
direction on the invalid plan; never silently make it dispatchable.

Each implementation section declares its approved execution strategy:

```markdown
<!-- execution: paired -->
<!-- checkpoints: structure-before,slice-after -->
```

Read the section's approved metadata before dispatching work. `execution` is
either `paired` or `autonomous`. `checkpoints` is `none`,
`structure-before`, `slice-after`, or
`structure-before,slice-after`. `none` is exclusive. Checkpoints always occur
in the declared order. Only a section whose approved execution is `paired` may
declare checkpoints. An approved autonomous section must declare
`checkpoints: none`; stop, report invalid approved metadata, and await user
direction before changing `tasks.md` or dispatching.

Persist effective execution state directly below the approved metadata:

```markdown
<!-- runtime-execution: paired -->
<!-- checkpoint-state: structure-before=pending,slice-after=pending -->
```

Create `runtime-execution` when the section begins if it is absent. Create
`checkpoint-state` only when the section declares one or more checkpoints.
Include only declared checkpoints. Each declared checkpoint is `pending`,
`approved`, or `waived`. Never modify approved `execution` or `checkpoints`
metadata to record runtime state.

Use `runtime-execution` when present. Otherwise, use approved `execution`.
Resume pending checkpoints from `checkpoint-state`. A completed checkpoint
stays approved or waived across sessions.

**Paired execution:** Dispatch one section agent for support edits and the
failing test. The agent establishes red, then returns an exact unapplied unified
production patch for one coherent production increment. Present that patch for
approval before applying it. One approval may cover multiple production files. A
rejected patch leaves production files unchanged and retains the failing test as
revision evidence. Give the rejection feedback to a fresh section agent and
redispatch the same increment. The orchestrator applies an approved patch and
runs focused verification to establish green.

The orchestrator may apply one approved paired production patch and run focused
verification. If `slice-after` is pending, keep every covered support and
production task unchecked until the user approves the verified slice. Without a
pending `slice-after`, mark each covered task `[x]` after focused verification.
The orchestrator may not otherwise edit production code.

**Autonomous execution:** Dispatch one section agent for direct red-green work.
The agent may edit production and support files. An approved autonomous section
has no checkpoints. A paired section switched to autonomous at runtime still
honors or explicitly waives its approved pending checkpoints. The agent stops at
those pending checkpoints and at all existing blockers, specification conflicts,
retry limits, and circuit breakers.

**`structure-before`:** Before tests or production implementation, present the
proposed production shape:
- Production ownership and intended files.
- Model fields, relationships, constraints, indexes, and nullability.
- Function, class, protocol, and payload signatures.
- Dependencies and transaction, queue, retry, or external-boundary behavior.
- Existing patterns to reuse.
- Material alternatives and the selected trade-off.

Wait for approval before continuing. Approval records
`structure-before=approved`. Keep it pending when rejected or when the user
requests revision.

**`slice-after`:** Once, after the first representative production increment
passes focused verification, present:
- The production-only multi-file diff.
- Implemented behavior and its entry point.
- Relevant persistence, task, or external-service boundaries.
- Focused verification results.
- Divergence from approved structure.
- The pattern proposed for remaining work.

Wait for approval before continuing. Approval records `slice-after=approved` and
prevents this checkpoint from recurring. Rejection keeps the provisional production slice
applied and keeps its tasks unchecked. Do not roll back the slice or require the
paired agent to edit production files. Give the feedback and current slice to a
fresh paired section agent. The agent may revise support files. Run revised or
retained support evidence against the current provisional production slice and
confirm it fails before returning an unapplied corrective production patch.
Present that patch for approval, apply an approved patch, rerun focused
verification, and present the corrected slice at the same pending checkpoint. A
prior explicit waiver records
`slice-after=waived` and prevents the checkpoint from recurring.

Apply user directives at the next safe production boundary after an active
section agent returns:
- `Finish this section on your own` sets `runtime-execution` to `autonomous`
  and retains pending checkpoints.
- `Finish without further review` sets `runtime-execution` to `autonomous`
  and marks each declared pending checkpoint `waived`.
- `Pair with me from here` sets `runtime-execution` to `paired`.
- `Show me the next slice` continues until the next declared pending checkpoint.

Do not rewrite completed work when applying an override. Do not use an override
to bypass red-green discipline, retry limits, blocker handling, circuit
breakers, branch rules, or `tasks.md` authority.

#### Active-Section Corrections and Reconciliation

Do not stop merely because user-directed implementation mechanics differ from
the task details. Apply the direction inside the active section without
evaluating it against the plan being corrected. An agent that suspects a detail
is wrong asks the user before changing implementation direction.

Keep only short drift notes needed by later work. User-directed model,
persistence, and migration mechanics are ordinary implementation corrections.
Existing operation permission gates remain unchanged, including approval before
executing a migration against a non-test database.

Mark each task `[x]` as soon as focused verification passes and every pending checkpoint requirement for that task is approved or waived. Task checkboxes are runtime progress, not task-content reconciliation. Keep task descriptions and affected later sections unchanged until every task in the section is complete and every declared checkpoint is approved or waived.

After the whole section is final, update the completed section's task descriptions and every affected later section once, identify remaining planning gaps without relitigating applied user guidance, clear the section's drift notes, and continue to the next section. Section reconciliation adds no drift checkpoint, report, reconciliation approval, or persona rerun.

### Working Memory: `learnings.md`

Apply keeps one ephemeral file, `.grimoire/changes/<change-id>/learnings.md` (create it from `templates/learnings.md` the first time you need it). It is the loop's memory between attempts and sessions, and it is **removed at finalize** with the rest of the change folder — nothing in it reaches the repo. Three sections, three lifecycles:

- **Failure-mode notes** — transient. After a failed attempt, append one line: what you tried and why it failed. Before any retry, read this section so you don't repeat a dead end. Prune a task's notes the moment it goes green. Never promote them.
- **Active-section drift notes** — short-lived. Record only user-directed corrections needed to reconcile the completed section or affected later work. Clear them after post-section reconciliation.
- **Discovered facts** — durable facts about the project learned while implementing (a build flag, a convention, an undocumented contract). Stage them here with their destination home; at finalize they are reconciled into that one home and cleared. Do **not** write them into `AGENTS.md`.

Subagents and fresh sessions read and append to this file the same way they use `tasks.md` — it is shared state on disk, not context-window memory.

### Stuck Detection & Recovery

**You MUST track failed attempts per task.** If a test won't go green, count your attempts:

- **Before any attempt past the first:** read the task's **failure-mode notes** in `learnings.md`. Do not repeat an approach already recorded there as failed.
- **Attempt 1:** Try the straightforward implementation from the task description.
- **Attempt 2:** If attempt 1 failed, append a failure-mode note (`<task-id> · tried … · failed: …`), re-read the error carefully, then try a *different* approach — not the same code with minor tweaks. State what you're doing differently and why.
- **Attempt 3 (final):** If attempt 2 failed, append the second dead end as a failure-mode note, then try one more *fundamentally different* approach. If the same error recurs, the problem is likely not in your implementation.

**After 3 failed attempts on a single task, STOP.** Do not continue. Instead:
1. Add a comment to `tasks.md` under the task: `<!-- BLOCKED: <summary> -->` (the full trail is already in the failure-mode notes)
2. Present to the user:
   - What the task requires
   - What you tried (all 3 approaches, briefly)
   - What error/failure persisted
   - Your best guess at the root cause
3. Wait for the user to decide: fix the task, provide guidance, skip it, or go back to plan.

**What counts as a "different approach":**
- Using a different library/API to achieve the same result
- Restructuring the code (different function signature, different data flow)
- Changing the test setup (different fixtures, different mocking strategy)

**What does NOT count:**
- Changing a variable name or adding a print statement
- Adding a try/catch around the same failing code
- Re-running the same code hoping for a different result

**In autonomous mode:** This rule is especially critical. Without it, the agent will loop until the token budget is exhausted. After 3 failed attempts, switch to review mode for that task and ask the user.

**Never silently retry the same approach.** If your implementation produced error X and you're about to write code that will produce error X again, stop and think about why. If you can't identify what would change the outcome, stop and ask.

### Circuit Breaker & Cross-Section Thrash (Autonomous Mode)

The per-task 3-attempt cap bounds a single task; it cannot see the *run* cycling. Autonomous mode adds a loop-level breaker the parent orchestrator checks **between sections**. Caps live under `llm.coding.limits` in `.grimoire/config.yaml`:

| Cap | Default | Kind |
|-----|---------|------|
| `max_sections_without_checkpoint` | 5 | followable — halt and checkpoint with the user |
| `consecutive_blocked` | 2 | followable — two BLOCKED sections in a row → halt |
| `max_cost_usd` | null (opt-in) | **soft** — self-reported; not harness-enforced in v1 |
| `max_wallclock_min` | null (opt-in) | **soft** — self-reported; not harness-enforced in v1 |

**Cross-section thrash detection:** halt the whole run — don't just retry locally — when the last two sections both ended BLOCKED, **or** when a section's failure-mode error class repeats the prior section's (read the failure-mode notes in `learnings.md` to compare). A failed attempt always leaves a note, so the thrash signal accumulates across sections; the breaker is the last resort once that signal shows the loop is stuck, not the first line of defense.

**On any trip:** stop, state the trip reason and a one-line diagnosis (what cycled, what was tried), and hand to the user. Do not continue past a tripped breaker.

> **Enforcement honesty:** the section and BLOCKED caps are orchestrator behavior the agent follows; the cost and wall-clock caps are *soft* — the agent self-reports against them and they are not enforced by the harness in v1. A hard, code-enforced breaker is a deferred follow-up.

### Session Management — MANDATORY Fresh Context Per Section

**Do NOT implement all tasks in a single conversation context.** Context accumulates across tasks and degrades output quality — the LLM starts hallucinating based on stale file contents it read 5 tasks ago. This is not a suggestion. Fresh context per task section is required.

**Size one section to one context.** The goal is not statelessness for its own sake. One coherent context carries the section from its first unchecked task through section reconciliation. Reset context between sections. If a section overflows its context, record current checkbox state and a handoff before starting a fresh context for the remaining section work.

Each task section in `tasks.md` has a `<!-- context: ... -->` block listing the exact files needed. This is the loading list for that section's fresh context.

#### Claude Code: Subagent Per Section

The parent agent is the **orchestrator only** — it does NOT implement tasks itself. The workflow is:

1. Parent reads `tasks.md`, finds the first unchecked section.
2. Parent reads the section's approved metadata and runtime state, then selects
   the dispatch prompt below.

   **Paired dispatch prompt:**
   ```
    You are implementing grimoire tasks in paired execution. Read
    `.grimoire/changes/<change-id>/tasks.md`, find section <N>, and prepare the
    next coherent production increment from its unchecked tasks.

   Section metadata: execution=<execution>; checkpoints=<checkpoints>.
   Runtime state: runtime-execution=<runtime-execution>;
   checkpoint-state=<checkpoint-state or none>.

   The agent may edit support files only. The agent must not edit production
   files. Support files include tests, Gherkin, and `.grimoire/changes/`
   coordination files.
   Establish red by writing and running the failing test. Return an exact unified
   production patch for one coherent production increment. Do not apply that
   patch. The orchestrator applies the approved patch and runs focused
   verification to establish green. Do not mark any task [x] until that
   verification passes. When `slice-after` is pending, keep covered tasks
   unchecked until the user approves the verified slice.

   When revising a rejected provisional `slice-after`, read the rejection
   feedback and current applied slice. Keep covered tasks unchecked. Revise
   support files when needed. Run revised or retained support evidence against
   the current provisional production slice and confirm it fails before returning
   an unapplied corrective production patch. Do not roll back or directly edit
   the provisional production slice.

   Use `.grimoire/changes/<change-id>/learnings.md` as working memory: read a
   task's failure-mode notes before retrying it and don't repeat a recorded dead
   end; append a failure-mode note after any failed attempt; prune them when the
   task goes green; append durable project facts to Discovered facts with their
   home (never to AGENTS.md). Never weaken or delete a test to force green. A
   user-directed correction to an implementation-specific test expectation must
   still demonstrate red against the current production code before production
   changes.

   Only user direction may create active-section implementation drift. Apply that direction without evaluating it or maintaining planning artifacts mid-section; otherwise ask the user before changing implementation direction.

   When the section is complete, write a <!-- SESSION: ... --> handoff note
   under the last task and exit.
   ```

   **Autonomous dispatch prompt:**
   ```
   You are implementing grimoire tasks in autonomous execution. Read
   `.grimoire/changes/<change-id>/tasks.md`, find section <N>, and implement all
   unchecked tasks in that section.

   Section metadata: execution=<execution>; checkpoints=<checkpoints>.
   Runtime state: runtime-execution=<runtime-execution>;
   checkpoint-state=<checkpoint-state or none>.

   You may edit production and support files. Follow the red-green cycle for
   each task. Mark each task [x] only after focused verification passes and every
   pending checkpoint requirement for that task is approved or waived. Stop at
   a declared pending checkpoint and at all existing blockers, specification
   conflicts, retry limits, and circuit breakers.

   Use `.grimoire/changes/<change-id>/learnings.md` as working memory: read a
   task's failure-mode notes before retrying it and don't repeat a recorded dead
   end; append a failure-mode note after any failed attempt; prune them when the
   task goes green; append durable project facts to Discovered facts with their
   home (never to AGENTS.md). Never weaken or delete a test to force green. A
   user-directed correction to an implementation-specific test expectation must
   still demonstrate red against the current production code before production
   changes.

   Only user direction may create active-section implementation drift. Apply that direction without evaluating it or maintaining planning artifacts mid-section; otherwise ask the user before changing implementation direction.

   Before writing production code, read `../references/code-quality.md`,
   `../references/testing-contracts.md`, and `../references/pattern-guard.md`.
   Before writing each test, run the pattern-guard brief. After writing
   production code, run the hallucination check before running tests.

   When the section is complete, write a <!-- SESSION: ... --> handoff note
   under the last task and exit.
   ```
3. Section agent reads `tasks.md` and the context files for that section.
4. Section agent implements tasks, marks each task complete when its focused
   verification and pending checkpoint requirements pass, and writes a handoff
   note with the current checkbox state.
5. For paired execution, the parent presents one patch. Rejection retains the
   red test and redispatches the same increment with revision feedback.
6. After patch approval, the parent applies it and runs focused verification.
7. If `slice-after` is pending, the parent presents the verified representative
   increment. It keeps covered tasks unchecked until approval. Approval marks
   the checkpoint approved. Rejection keeps the
   provisional slice applied and both the checkpoint and tasks pending. The
   parent sends the feedback and current slice to a fresh paired agent, which
   returns an unapplied corrective production patch. The parent repeats patch
   approval, focused verification, and the same slice checkpoint.
8. Without a pending `slice-after`, the parent retains focused verification
   evidence and continues the section.
9. When all section tasks are complete and all checkpoints are approved or
   waived, reconcile the completed task descriptions and affected later sections
   once, then clear drift notes.
10. If section work remains, redispatch the same section. Otherwise, spawn the
    next section agent.
11. Repeat until all sections complete.

**The parent agent MUST NOT write production code or test code.** It may apply an approved paired production patch. Its other jobs are reading `tasks.md`, spawning subagents, and checking completion between sections. If the parent starts implementing tasks directly, context will degrade by section 3-4 and output quality will drop.

#### Other Agents (Codex, Cursor, Windsurf, etc.)

Start a **fresh session** for each task section. The resume mechanism via `tasks.md` checkboxes makes this seamless:

1. Open a new session
2. Tell the agent: "Run `/grimoire:apply` on change `<change-id>`"
3. The agent reads `tasks.md`, finds the first `- [ ]`, reads that section's context block
4. When the section is complete, end the session
5. Start a new session for the next section

This is the same pattern as the [Ralph Wiggum loop](https://ralph-wiggum.ai) — progress lives in files (`tasks.md` + git), not in the context window. Each session gets a clean slate and reads current file state.

#### Handoff Notes

Before exiting (subagent exit or session end), write a handoff note in `tasks.md`:

```markdown
- [x] 1.3 Implement TOTP verification
<!-- SESSION: completed 1.1-1.3. auth middleware moved to middleware/auth.ts. pyotp added to requirements. Next section needs the new middleware import. -->
```

This gives the next session critical context (architectural decisions made, files created/moved, gotchas discovered) without requiring it to re-read everything.

#### When to Force a Fresh Context Mid-Section

Even within a section, break early if:
- You needed 3 attempts on a task (stuck detection recovery)
- You notice degraded output (repeating yourself, forgetting earlier context, making mistakes on things you got right earlier)
- The section has more than 5 tasks

Write a handoff note at the break point and start fresh.

**Check `.grimoire/config.yaml`** for the configured coding agent — use `llm.coding.command` and `llm.coding.model` for implementation work.

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
Work through `tasks.md` sequentially. **Every task follows the same cycle: test → red → code → green → next.** The cycle is identical at every level; only the *test vehicle* changes per the task's `verify:` tag (`scenario` → step definitions; `unit-invariant` / `characterization` → unit/integration test). "Step definitions" below means *the failing test at the task's level* — for non-`scenario` tasks, write a unit test, not a `.feature`.

**For each task:**
1. Announce which task you're working on
   - Read the task's `verify:` tag — it decides the test vehicle. `scenario` → write/extend step definitions for the named scenario. `unit-invariant` → write a unit/integration test asserting the constraint. `characterization` → write a unit test pinning current/intended behavior. If a `unit-invariant` task has no matching constraint in `.grimoire/docs/constraints.md`, STOP and flag — don't invent a scenario to fill the gap.
   - **Pattern brief** (before writing anything): classify code type → `search_graph` for 3–5 peers (excluding last 60 days) → `get_code_snippet` → extract modal pattern across the four critical seams (error handling, dependency access, abstraction depth, return shape) → write a 5–8 rule brief. Skip if graph not indexed or < 3 peers. Full instructions in `../references/pattern-guard.md`.
2. Write the test FIRST, at the task's level (step definitions for `scenario`; unit/integration test for `unit-invariant`/`characterization`). **Generate test data, don't ask for it and don't hand-invent it** — build records through the project's data factory / property-based tool (`../references/testing-contracts.md` §Test Data Generation; detect it from `config.tools` / existing test imports), overriding only the fields this case pins. AI-authored literal data is a last resort, only when the user explicitly asked for it or no factory exists and a specific crafted value is needed — and note why when you do.
3. Run the test — **it MUST FAIL (red)**
4. If the test passes immediately, STOP. The test is broken — it's not actually testing anything. Fix it so it makes a real assertion that fails without production code. Common causes:
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
6. Run the step definitions again — they should PASS (green)
7. If still red, fix the production code (not the test)
8. **Hallucination check:** Before running tests, verify every external function/method your new code calls actually exists in the graph: `search_graph(name_pattern="<name>")` for each. If not found: find the correct function or stop and flag to user. Do not run tests against calls to non-existent functions. (Full instructions in `../references/pattern-guard.md` Step 6.)
9. **Test quality check:** Before marking done, verify your step definitions have strong assertions:
   - Every Then step has a specific `assert` or `expect` with an exact expected value (not `assert True`, not `toBeDefined()`)
   - No empty function bodies (`pass`, `...`, or no-op)
   - Assertions check behavior, not just types or existence — "response status is 302 and redirect URL is /dashboard/" not "response is not None"
   - If you wrote a test that would pass against a null/trivial implementation, strengthen it
10. **Code quality check:** Walk the seven-point checklist in `../references/code-quality.md` against every file you changed. Any fail → fix code, re-run tests, re-check. Do not mark `[x]` while a check fails.
11. **Reconcile task working memory:** prune this task's failure-mode notes from `learnings.md` — it's green, they've served their purpose. If you learned a durable project fact while implementing (a build flag, a convention, an undocumented contract, an architectural constraint), append it to the **Discovered facts** section with its destination home — don't write it into `AGENTS.md` and don't leave it only in context.
12. Mark complete: `- [ ]` → `- [x]` as soon as focused verification and pending checkpoint requirements pass.
13. Record the red-green result and current checkbox state in the section handoff, then move to the next task. After the whole section is final, reconcile task descriptions and affected later sections once.

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
When all implementation tasks are complete:
- Run the BDD test suite (command from `config.tools.bdd_test`) — existing behavior must not break
- All scenarios should pass — new AND existing
- If new scenarios fail, fix the implementation (not the feature file — the feature is the spec)
- If existing scenarios break, you've introduced a regression — fix it before proceeding
- Check ADR confirmation criteria if applicable
- Run the project's full test suite (`config.tools.unit_test`) if configured — grimoire tests don't replace existing tests
- **Diff against the baseline** (`baseline.md` from step 3b): a failure already in the baseline is pre-existing and accepted; a failure NOT in the baseline is a regression you introduced — fix it before finalize. If the baseline was skipped, say so and list all failures for the user rather than claiming "existing tests pass."

**The verify step is not optional. Do not proceed to finalize with failing tests.**

### 6a. Final Staged Review

Run this procedure after finalization has removed the change folder, regenerated
documentation, and staged the complete durable final state. It is an aggregate
safety net and does not replace paired checkpoints.

1. Identify the target branch and its merge base.
2. Confirm the ordinary Git index contains every intended durable change,
   including any tracked change-folder deletion. Resolve every missing or
   unrelated staged path before presenting the review.
3. Present the complete merge-base-to-index path list:
   ```
   git diff --cached --name-status "$(git merge-base <target-branch> HEAD)"
   ```
   Group every listed path under `Production` or `Support`. Production paths
   implement runtime behavior. Support paths include tests, Gherkin, decisions,
   documentation, and tracked coordination-file deletions. Treat an unknown path
   as production until classified. Exclude nothing from approval.
4. Present the full merge-base-to-index diff without a pathspec:
   ```
   git diff --cached "$(git merge-base <target-branch> HEAD)"
   ```
5. Require explicit user approval of the complete staged path list and full
   merge-base-to-index diff. Approval covers both production and support paths.
6. On approval, immediately create one final commit from the reviewed index. Do
   not edit or restage between approval and commit. Include `Change: <change-id>`
   and `Final-production-review: approved` trailers.

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
- **Tests are not optional.** Every task produces both production code and passing step definitions. No exceptions.
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
- `grimoire-verify` to confirm implementation matches specs
- `grimoire-commit` to commit the changes
- `/grimoire:pr` to create the PR — it executes §7 first if the change folder is still present
