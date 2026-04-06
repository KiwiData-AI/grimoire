# grimoire-apply

Implement tasks from a planned grimoire change. Write production code AND tests. A task is not complete until its scenarios pass.

## CRITICAL: Do Not Re-Plan

**`tasks.md` IS the plan. Do not enter plan mode. Do not create your own plan. Do not reorganize, re-derive, or "think through" the tasks before starting.**

The plan was already created in the plan stage, reviewed by the user, and approved. Your job is to EXECUTE it, not to re-evaluate it. Read `tasks.md`, find the first unchecked task, and start working.

If you believe a task is wrong, incomplete, or impossible — flag it to the user. Do not silently re-plan. Do not skip tasks. Do not reorder tasks unless the user asks.

This applies to all LLMs: Claude, Codex, Cursor, Copilot, etc. The task list is the authority.

## Triggers
- User wants to implement a planned grimoire change
- User asks to apply, implement, or build a grimoire change
- Loose match: "apply", "implement", "build" with a change reference

## Prerequisites
- A change exists in `.grimoire/changes/<change-id>/` with:
  - `manifest.md`
  - `tasks.md` (from plan stage)
  - At least one `.feature` file or decision record

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

### Stuck Detection & Recovery

**You MUST track failed attempts per task.** If a test won't go green, count your attempts:

- **Attempt 1:** Try the straightforward implementation from the task description.
- **Attempt 2:** If attempt 1 failed, re-read the error carefully. Try a *different* approach — not the same code with minor tweaks. State what you're doing differently and why.
- **Attempt 3 (final):** If attempt 2 failed, try one more *fundamentally different* approach. If the same error recurs, the problem is likely not in your implementation.

**After 3 failed attempts on a single task, STOP.** Do not continue. Instead:
1. Add a comment to `tasks.md` under the task: `<!-- BLOCKED: <summary of what was tried and what failed> -->`
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

### Session Management

Context accumulates across tasks and degrades output quality. Use the per-task context blocks in `tasks.md` to keep sessions focused.

**Each task section in `tasks.md` has a `<!-- context: ... -->` block** listing the exact files needed for that section. This is your loading list — read those files and no others when starting a section.

**Recommended approach (Claude Code):** Use a subagent per task section. The parent agent reads `tasks.md`, identifies the next unchecked section, spawns a subagent with the files from that section's context block, and the subagent executes, marks tasks complete, and exits. The parent then spawns the next subagent.

**For other agents (Codex, Cursor, etc.):** Start a fresh session for each task section. The context block tells you exactly what to load. The resume mechanism via `tasks.md` makes this seamless — the next session reads `tasks.md`, finds the first `- [ ]`, reads the context block for that section, and continues.

**Handoff blocks:** When ending a session (or before spawning a new subagent), write a handoff note in `tasks.md` under the last completed task:

```markdown
- [x] 1.3 Implement TOTP verification
<!-- SESSION: completed 1.1-1.3. auth middleware moved to middleware/auth.ts. pyotp added to requirements. -->
```

This gives the next session critical context without requiring it to re-read everything.

**When to break sessions:**
- After completing a task section (the natural boundary — each section has its own context block)
- When you notice your outputs degrading (repeating yourself, forgetting earlier context, making mistakes)
- After a stuck detection recovery (you needed 3 attempts on a task)

**Check `.grimoire/config.yaml`** for the configured coding agent — use `llm.coding.command` and `llm.coding.model` for implementation work.

### 3. Create Feature Branch
Before writing any code, ensure you're on a feature branch for this change:

```
git checkout -b <type>/<change-id>
```

Where `<type>` is `feat`, `fix`, `refactor`, or `chore` based on the change. If a branch already exists (resuming work), switch to it. Update the manifest's `branch:` field with the branch name.

This links the git history to the grimoire change — `grimoire trace` and `grimoire log` depend on it.

### 4. Load Context

**Use the context blocks in `tasks.md`.** Each task section has a `<!-- context: ... -->` comment listing the exact files to load for that section. This was computed during planning with full codebase knowledge. Load those files — they include the relevant feature files, area docs, and source files you'll need.

**Loading order:**
1. `tasks.md` — your checklist (load once at start, find the current section)
2. Read the `<!-- context: ... -->` block for the current section
3. Load each file listed in the context block
4. If a listed file doesn't exist, it may need to be created as part of the task — that's fine

**If the context window fills up** (degraded output quality, forgotten context, repeated mistakes):
1. Finish or pause the current task
2. Summarize progress in `tasks.md` (mark completed tasks, add handoff note)
3. Tell the user: "Context is getting large. I've updated tasks.md with progress. A fresh session can resume from here."

### 4. Implement Tasks
Work through `tasks.md` sequentially. **Every task follows the same cycle: code → test → green → next.**

**For each task:**
1. Announce which task you're working on
2. Write the step definitions FIRST (the test that will verify this task)
3. Run the step definitions — **they MUST FAIL (red)**
4. If the test passes immediately, STOP. The test is broken — it's not actually testing anything. Fix the step definition so it makes a real assertion that fails without production code. Common causes:
   - Empty step definition body (passes by default)
   - Assertion against a mock/fixture that already satisfies the condition
   - Step wired to wrong function or missing the actual check
   - Overly broad assertion that matches anything
5. Once confirmed red: write the production code to make it pass
6. Run the step definitions again — they should PASS (green)
7. If still red, fix the production code (not the test)
8. **Test quality check:** Before marking done, verify your step definitions have strong assertions:
   - Every Then step has a specific `assert` or `expect` with an exact expected value (not `assert True`, not `toBeDefined()`)
   - No empty function bodies (`pass`, `...`, or no-op)
   - Assertions check behavior, not just types or existence — "response status is 302 and redirect URL is /dashboard/" not "response is not None"
   - If you wrote a test that would pass against a null/trivial implementation, strengthen it
9. Mark complete: `- [ ]` → `- [x]`
10. Move to next task

**This is strict red-green BDD.** A test that has never been red has never proven it can catch a failure. The red step is NOT a formality — it is the proof that the test works. If you skip it or the test passes immediately, you have a false positive that provides zero safety.

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

### 4. Verify
When all implementation tasks are complete:
- Run ALL feature files (not just the new ones) — existing behavior must not break
- All scenarios should pass — new AND existing
- If new scenarios fail, fix the implementation (not the feature file — the feature is the spec)
- If existing scenarios break, you've introduced a regression — fix it before proceeding
- Check ADR confirmation criteria if applicable
- Run the project's full test suite if one exists — grimoire tests don't replace existing tests

**The verify step is not optional. Do not proceed to finalize with failing tests.**

### 5. Finalize
When all tests are green:
1. Copy proposed `.feature` files from `.grimoire/changes/<change-id>/features/` to `features/` (replacing baseline)
2. Move new decision records to `.grimoire/decisions/` with proper sequential numbering
3. Update MADR status from `proposed` to `accepted` and set the date
4. If `data.yml` exists, merge the changes into `.grimoire/docs/data/schema.yml` — apply adds/modifies/removes so the baseline schema stays current
5. Move `manifest.md` to `.grimoire/archive/YYYY-MM-DD-<change-id>/`
6. Remove the change directory from `.grimoire/changes/`

### 6. Summary
Present a brief summary:
- What was implemented
- Which features now pass (with test counts if available)
- Which decisions were accepted
- Any follow-up items

**Step definition anti-patterns to avoid:**
- `def step_impl(): pass` — empty body, always passes, tests nothing
- Asserting against the return value of the function you just wrote (circular)
- `assert True` or `assert response is not None` — trivially true
- Mocking the thing you're supposed to be testing
- Catching exceptions in the step def so it never fails

**Step definition rules:**
- Every assertion must be specific: assert the exact expected value, status, state, or side effect
- Use real data, not mocks, when testing behavior (mock external services only)
- If a step def has no `assert` statement, it's suspicious — it should either assert something or set up state that a later Then step asserts

## Verify Before Using

Before importing a module, calling a function, or adding a dependency — confirm it exists. Hallucinated imports are one of the most common LLM coding failures.

**Imports and functions:**
- Check area docs' Reusable Code table first — these are confirmed to exist with exact paths and line numbers
- If you're importing from a file you haven't read, read it first (or at minimum check the area doc that covers it)
- If an import fails when you run tests, don't guess at the correct path — read the actual module to find the real export name

**Dependencies and packages:**
- Only add packages that are already in `package.json`, `requirements.txt`, `pyproject.toml`, or equivalent
- If a task requires a new package, check that it exists (it should be specified in the task from the plan stage)
- Never guess at a package name — `pip-audit` won't catch a hallucinated package, but installing malware will catch you

**APIs and endpoints:**
- Check `schema.yml` for external API contracts before calling them — it has the real endpoints, methods, and field names
- For internal APIs, read the area doc or the actual route file — don't assume endpoint paths

**If something doesn't exist that a task says should:** Flag it to the user. The task may reference a utility that was renamed, a package that was removed, or an API that changed. Don't invent a replacement — the plan may need updating.

## Implementation Principles
- **Write the minimum code that makes the test green.** Don't add error handling for cases that can't happen, parameters nobody passes, or flexibility nobody asked for. The feature file defines what "done" looks like — satisfy it and stop.
- **Prefer modifying existing files over creating new ones.** A new file needs a strong reason: a genuinely new domain concept, a boundary the architecture requires. Adding a function to an existing module is almost always better than a new file with one function.
- **Inline over abstraction.** If a piece of logic is used once, keep it inline. Extract a helper only when you see the same logic repeated in the current change AND it has a clear, stable interface. Don't extract "for readability" — clear variable names and short functions are readable without indirection.
- **Use what the codebase already has.** Before writing a utility, check if one exists. Before adding a dependency, check if the standard library covers it. Before creating a pattern, check if the codebase has an established way to do this.
- **No speculative code.** Don't add TODO comments for future work, don't stub out interfaces for planned features, don't add configuration for things that have one value. Build what's needed now.

## Important
- **Tests are not optional.** Every task produces both production code and passing step definitions. No exceptions.
- **Red-green is mandatory, not aspirational.** A test must fail before it passes. If it doesn't fail, it's not a real test. Fix it before moving on.
- **A test that always passes is worse than no test.** It gives false confidence. If you can't make a step definition fail, you don't understand what it's testing.
- The feature file is the spec. If a test fails, fix the code, not the feature.
- If implementation reveals that a scenario is wrong or missing, STOP and go back to draft. Don't silently change features.
- Keep changes minimal and focused — only implement what's in tasks.md
- If blocked, flag it rather than working around it
- Commit frequently — one commit per logical task is ideal. Every commit during apply **MUST** include a `Change: <change-id>` git trailer for audit traceability. Use `/grimoire:commit` or manually add the trailer.
- Existing tests must keep passing. A grimoire change that breaks existing behavior is not complete.
