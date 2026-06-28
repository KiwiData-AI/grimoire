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

**Artifacts are edited live on the feature branch.** Features, decisions, constraints, and schema are real files in `features/`, `.grimoire/decisions/`, `.grimoire/docs/`. There is no copy-into-change-folder and no promote step — `git diff` is the staging area. The change folder holds only ephemeral process scaffolding (`manifest.md`, `tasks.md`, and the apply-maintained `learnings.md`).

## CRITICAL: Two Rules That Must Not Be Broken

### 1. Do Not Re-Plan

**`tasks.md` IS the plan. Do not enter plan mode. Do not create your own plan. Do not reorganize, re-derive, or "think through" the tasks before starting.**

### 2. Do Not Implement All Tasks In One Context

**Spawn a fresh subagent (or start a fresh session) for each task section.** The parent/orchestrator reads `tasks.md` and delegates — it does NOT write code itself. Context degrades after 3-4 tasks and the LLM starts making mistakes based on stale file contents. See "Session Management" below for the exact workflow.

The plan was already created in the plan stage, reviewed by the user, and approved. Your job is to EXECUTE it, not to re-evaluate it. Read `tasks.md`, find the first unchecked task, and start working.

If you believe a task is wrong, incomplete, or impossible — flag it to the user. Do not silently re-plan. Do not skip tasks. Do not reorder tasks unless the user asks.

This applies to all LLMs: Claude, Codex, Cursor, Copilot, etc. The task list is the authority.

## Triggers
- User wants to implement a planned grimoire change
- User asks to apply, implement, or build a grimoire change
- Loose match: "apply", "implement", "build" with a change reference

## Routing
- No tasks.md exists → `grimoire-plan` first
- Task seems wrong or impossible → flag to user; do NOT silently re-plan or skip
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

### 2. Choose Execution Mode
Ask the user how they want to work through the task list:

**Review mode (default):** Before each task, present what you plan to implement and which files you'll touch. Then for each file change:
1. Show the proposed change (what you plan to write/edit and why)
2. Wait for user approval before writing to that file
3. If the user requests modifications, revise and re-present before writing

After all file changes for a task are approved and written, run the tests and show results. Wait for user approval before moving to the next task. The user can request changes, ask questions, reorder, or skip tasks at any point.

**Autonomous mode:** Work through the entire task list without pausing between tasks. Only stop if:
- A test won't go green after reasonable attempts (you're stuck)
- Implementation reveals the spec is wrong (needs to go back to draft)
- You hit an external blocker (missing dependency, permissions, etc.)

If the user doesn't specify, default to review mode.

**Both modes:** Update `tasks.md` in real time as work progresses. Mark tasks `- [x]` the moment they pass. If a task is split, reordered, or new tasks are discovered during implementation, update `tasks.md` immediately so it always reflects the current state. The task list is the source of truth for progress — if the session is interrupted, the next agent should be able to read `tasks.md` and know exactly where to resume.

### Working Memory: `learnings.md`

Apply keeps one ephemeral file, `.grimoire/changes/<change-id>/learnings.md` (create it from `templates/learnings.md` the first time you need it). It is the loop's memory between attempts and sessions, and it is **removed at finalize** with the rest of the change folder — nothing in it reaches the repo. Two sections, two lifecycles:

- **Failure-mode notes** — transient. After a failed attempt, append one line: what you tried and why it failed. Before any retry, read this section so you don't repeat a dead end. Prune a task's notes the moment it goes green. Never promote them.
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

**Size one task to one context.** The goal is not statelessness for its own sake — a task should be small enough that one coherent context carries it start to finish (stateful *within* a task), and context is reset *between* tasks. If a single task overflows its context mid-flight, that is a **smell that the task is too big** — split the spec, don't paper over it with a stateless restart loop. Fresh-context-per-section gives you the "reset between" half for free; keeping tasks small gives you the "continuity within" half.

Each task section in `tasks.md` has a `<!-- context: ... -->` block listing the exact files needed. This is the loading list for that section's fresh context.

#### Claude Code: Subagent Per Section

The parent agent is the **orchestrator only** — it does NOT implement tasks itself. The workflow is:

1. Parent reads `tasks.md`, finds the first unchecked section
2. Parent spawns a **subagent** (Agent tool) with this prompt:
   ```
   You are implementing grimoire tasks. Read `.grimoire/changes/<change-id>/tasks.md`,
   find section <N>, and implement all unchecked tasks in that section.
   Follow the red-green BDD cycle for each task. Mark tasks [x] when done.

   Use `.grimoire/changes/<change-id>/learnings.md` as working memory: read a
   task's failure-mode notes before retrying it and don't repeat a recorded dead
   end; append a failure-mode note after any failed attempt; prune them when the
   task goes green; append durable project facts to Discovered facts with their
   home (never to AGENTS.md). Never weaken or delete a test to force green.

   Before writing any production code, read `../references/code-quality.md`,
   `../references/testing-contracts.md`, and `../references/pattern-guard.md`.
   Apply the code-quality rules WHILE you write (not after) — reuse before write,
   trust callers (no defensive guards inside the trust boundary), specific names
   (no `data`/`result`/`temp`), branching budget ~7, function size ~30 lines,
   no premature abstraction, comments only for non-obvious WHY.
   Before writing the test for each task, run the pattern-guard brief (Steps 1–1b–2–4):
   classify the code type (Step 1), run reuse discovery — two search_graph calls
   by concept and by name to find existing code to call instead of writing (Step 1b),
   find 3–5 peers via search_graph (Step 2), extract the modal pattern, write a brief.
   Write code that matches the brief. After writing production code, run the
   hallucination check (Step 6): verify every called external function exists in
   the graph before running tests.

   When the section is complete, write a <!-- SESSION: ... --> handoff note
   under the last task and exit.
   ```
3. Subagent reads `tasks.md` and the context files for that section
4. Subagent implements, marks tasks `[x]`, writes handoff note, exits
5. Parent reads updated `tasks.md`, spawns next subagent for next section
6. Repeat until all sections complete

**The parent agent MUST NOT write production code or test code.** Its only jobs are: read `tasks.md`, spawn subagents, and check completion between sections. If the parent starts implementing tasks directly, context will degrade by section 3-4 and output quality will drop.

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

### 3. Create Feature Branch
Before writing any code, ensure you're on a feature branch for this change:

```
git checkout -b <type>/<change-id>
```

Where `<type>` is `feat`, `fix`, `refactor`, or `chore` based on the change. If a branch already exists (`grimoire-branch-guard` or `grimoire-draft` usually created it), switch to it. Update the manifest's `branch:` field with the branch name.

The branch links the git history to the change via the `Change: <change-id>` commit trailer. The branch IS the isolation and `git diff` IS the staging — there is no separate promote step.

### 3b. Capture Test Baseline
Before writing the first test, run the configured suites once to record the starting state, then **present any pre-existing failures to the user and get acceptance before proceeding**. This is the run you'd do anyway to understand where you're starting — just save the result. Write it to `.grimoire/changes/<change-id>/baseline.md` so `grimoire-verify` can tell a regression you introduced from a failure that was already red. Skippable when no test command is configured or the user opts out (record the skip — don't leave it silent). Full protocol: `../references/test-baseline.md`.

The point: a failure is "pre-existing" only if it's in `baseline.md`. This replaces end-of-run "that's a pre-existing failure" surprises with a start-of-run acceptance the user signed off on.

> **No promote.** Feature files, decisions, and constraints were drafted directly into their live locations (`features/`, `.grimoire/decisions/`, `.grimoire/docs/constraints.md`) on this branch. BDD runners already discover the scenarios from `features/`. Do not copy anything out of `.grimoire/changes/` — that folder holds only `manifest.md` and `tasks.md`.

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
11. **Reconcile working memory:** prune this task's failure-mode notes from `learnings.md` — it's green, they've served their purpose. If you learned a durable project fact while implementing (a build flag, a convention, an undocumented contract, an architectural constraint), append it to the **Discovered facts** section with its destination home — don't write it into `AGENTS.md` and don't leave it only in context.
12. Mark complete: `- [ ]` → `- [x]`
13. Move to next task

**This is strict red-green BDD.** A test that has never been red has never proven it can catch a failure. The red step is NOT a formality — it is the proof that the test works. If you skip it or the test passes immediately, you have a false positive that provides zero safety.

**Never game the gate (reward-hack guard).** When a test won't pass, fix the production code — never weaken or delete the test to force green. Deleting a test, loosening an assertion to match wrong output, narrowing what it checks, or skipping/`xfail`-ing it to get a green run is **stop-and-flag**, not a valid completion. The gate is the convergence signal; gaming it produces plausible-wrong code faster. If a test genuinely encodes the wrong expectation, that is a spec problem — STOP and go back to draft, don't quietly edit the test to pass.

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

### 7. Finalize
When all tests are green. Features, decisions, and constraints were edited live on the branch — finalize flips states, applies the schema delta, and clears the ephemeral scaffolding:
1. Decision records already live in `.grimoire/decisions/` (drafted there, numbered at draft time). Flip MADR status from `proposed` to `accepted` and set the date.
2. Constraints (`.grimoire/docs/constraints.md`) were edited in place — nothing to move.
3. If the change has a `data.yml` (schema delta), apply its `add`/`modify`/`remove` entries to the live `.grimoire/docs/data/schema.yml` so the baseline schema stays current. `data.yml` is a migration-delta spec (ephemeral scaffolding carrying nullability/safety/ordering intent a raw diff wouldn't), not a copy of the schema — `schema.yml` is the live target; the delta is discarded with the change folder.
4. Refresh the project overview: run `grimoire docs`. It regenerates `.grimoire/docs/OVERVIEW.md` (the human entry point) from the now-current features, constraints, decisions, and schema — superseded decisions drop out automatically. This is the existing `docs` command, not a new one.
5. Reconcile `learnings.md`: for each entry under **Discovered facts**, write it into the home it names — an area doc (`.grimoire/docs/<area>.md`), a decision, a constraint, or `schema.yml`. Confirm the routing with the user (it's correctable) and drop stale ones. Failure-mode notes are discarded, not promoted. This is the one place facts learned during apply enter the durable record — `AGENTS.md` is never the destination.
6. Remove the change directory `.grimoire/changes/<change-id>/`. Its `manifest.md` + `tasks.md` + `learnings.md` (+ any `data.yml`) and the `draft.md` design doc are ephemeral process scaffolding. `draft.md` was retained read-only through the pipeline as the agreed-design reference; this is its closing deletion.

   **Guard — never delete uncommitted scaffolding.** `git log` only preserves what was committed. If `draft.md`/`tasks.md`/`manifest.md`/`learnings.md` were never committed (e.g. draft and plan ran without intermediate commits), deleting them now loses them permanently — there is no recovering an untracked file. Before removing the folder, verify it is in history:
   ```
   git ls-files --error-unmatch .grimoire/changes/<change-id>/draft.md
   ```
   If that errors (untracked), or `git status` shows uncommitted edits under the change folder, **commit the scaffolding first** (see step 8 — this becomes the first of two commits), then delete. If you cannot commit, STOP and tell the user rather than deleting.

   The durable record is the branch, the PR, and `git log` — linked by the `Change: <change-id>` trailer; once committed, git history preserves `draft.md` if ever needed. **There is no archive tree** (don't reinvent git history).

### 8. Commit

The commit captures the finished state — accepted decisions, live artifacts, cleared scaffolding — not mid-flight change artefacts.

**Order depends on whether the scaffolding is already in history (see step 6's guard):**

- **Scaffolding already committed** (draft/plan committed earlier, the normal case): finalize fully — including the folder removal — then make one commit capturing the accepted state and the deletion.
- **Scaffolding NOT yet committed** (this is the change's first commit): you cannot delete-then-commit, or the scaffolding is lost forever. Make **two commits**: (1) commit the implementation, live artifacts, and the still-present change folder so history preserves `draft.md`/`tasks.md`; (2) remove the folder and commit the deletion. Both carry the `Change: <change-id>` trailer.

Stage the live artifacts (and, in the single-commit case, the scaffolding removal):
```
git add features/ .grimoire/decisions/ .grimoire/docs/ src/ tests/
git add -u  # picks up the removed change directory (single-commit case)
```

Then commit using `/grimoire:commit` (reads change context for the message) or write a manual message following `AGENTS.md` commit trailer conventions:
```
feat(<change-id>): <short description>

<body if needed>

Change: <change-id>
Scenarios: "<scenario 1>", "<scenario 2>"
```

Mid-task commits are fine — commit whenever it makes sense during implementation. **Do not open a PR before finalize is complete.** The PR should represent the finished, archived state of the change.

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
When all tasks are complete, tests pass, and artifacts are finalized, the workflow is complete. Present the summary and suggest:
- `grimoire-verify` to confirm implementation matches specs
- `grimoire-commit` to commit the changes
