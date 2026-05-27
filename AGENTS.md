# Grimoire — AI Assistant Instructions

Grimoire is a spec-driven development workflow using **Gherkin** for behavioral requirements and **MADR** for architecture decisions. These instructions apply to any AI coding assistant.

## Engineering Principles

These principles govern all grimoire work — drafting, planning, reviewing, and implementing.

**Simple over clever.** Choose the straightforward approach. A few lines of obvious code beat an elegant abstraction. If a junior developer would need to pause and think about how it works, simplify it.

**Less code is more.** Every line is a liability — it must be read, tested, maintained, and debugged. Delete what you can. Inline what's used once. Don't write code "in case we need it later."

**Don't abstract early.** Three copies of similar code is fine. An abstraction should be extracted when a clear, stable pattern has emerged — not when you see the first hint of repetition. Wrong abstractions are harder to fix than duplicated code.

**Solve the problem in front of you.** Do not add configurability, feature flags, extension points, plugin systems, or generic interfaces unless the task specifically calls for them. Build for the current requirement, not imagined future ones.

**Use what exists.** Before writing anything, check what's already in the codebase. Use existing utilities, patterns, conventions, and libraries. Read `.grimoire/docs/` if area docs exist. A new dependency or utility needs a reason.

**Small surface area.** Fewer public functions, fewer parameters, fewer options. A function that does one thing with two parameters beats one that does three things with six parameters and a config object.

**Obvious structure.** Follow the project's existing file layout, naming conventions, and patterns. New code should look like it was written by the same team. Don't reorganize, rename, or "improve" structure that isn't part of your change.

**Errors at the boundary.** Validate user input and external data at the edges. Internal code can trust its callers — don't defensive-program against situations that can't happen.

**Verify before using.** Before importing a module, calling a function, or adding a dependency — confirm it exists. Check `.grimoire/docs/<area>.md` for reusable code with exact paths. Check `.grimoire/docs/data/schema.yml` for real model fields and API endpoints. If you haven't read the file you're importing from, read it (or its area doc) first. Never guess at package names, function signatures, or API paths.

## Anti-Loop Protocol

Applies everywhere: writing code, running tests, fixing checks, editing files. These rules exist because loops are expensive — each iteration burns context and time, and the later iterations are usually worse than just stopping.

### Attempt budget: 3

Count attempts per discrete problem (one failing test, one failing check, one broken script). After 3 failed attempts:

1. **Stop.** Do not attempt #4.
2. **Diagnose.** State the pattern: what you tried each time, what failed each time, what's different and what's the same.
3. **Escalate.** Present the diagnosis to the user and ask how to proceed. Don't silently switch to a different approach without saying so.

A "different attempt" means a fundamentally different approach — not the same fix with minor tweaks. If attempt 2 makes the same type of change as attempt 1, it counts as the same attempt.

### Change approach after 2 failures of the same type

If the second failure looks like the first failure (same error class, same location, same check), the approach is wrong — not the implementation. Don't attempt a third narrow fix. Step back and ask: is the whole approach wrong? Is there a simpler path?

Examples:
- Two shell scripts with portability bugs → stop writing scripts, use prose or build into the tool
- Two attempts to fix the same failing test → reread the test and the code together, don't just tweak values
- Two check failures on the same file → run the check manually and read the full output before editing

### Pre-validate before acting

Don't use side-effect actions (commits, test runs, check runs) as the primary validator. Validate first, then act.

- Shell scripts: run against the actual codebase before embedding in any file
- Commits: run `grimoire check <step>` manually, fix all issues, then commit once
- Code: read the function you're calling before calling it — don't rely on the compiler or test runner to catch typos in function names

### Diagnose before fixing

After any failure, state what you observe before proposing a fix. One sentence: what failed, where, and why. If you can't state the why, you're not ready to fix it.

This applies especially to test failures. "The test failed" is not a diagnosis. "The test expected `302` but got `200` because the redirect middleware isn't registered in the test client" is.

## When to Use Grimoire

Use grimoire when the user's request involves:
- New user-facing functionality (→ Gherkin feature)
- Changes to existing behavior (→ Gherkin feature)
- Technology or architecture decisions (→ MADR decision record)
- Non-functional requirements like performance targets or security policies (→ MADR decision record)

**Do NOT use grimoire for:**
- Bug fixes — the feature file already describes correct behavior. Just fix the code.
- Pure refactoring — no behavior change means no scenario change. May warrant an ADR if architectural.
- Config changes, dependency updates, formatting — no behavioral or architectural impact.

**Routing rule:** If the request is expressible as Given/When/Then, it's a Gherkin feature. If it's a trade-off, choice, or structural decision, it's an ADR. If it's neither, it doesn't belong in grimoire.

## Decision Tree: What Do I Do?

```
User has a request
│
├─ "Something is broken / not working right"
│  │
│  ├─ Reporter is a tester / non-developer?
│  │  → /grimoire:bug-report → structured bug report with spec references
│  │
│  ├─ Developer picking up a bug report?
│  │  → /grimoire:bug-triage → validate, reject with evidence, or request info
│  │    If validated → /grimoire:bug for the fix (repro test first)
│  │
│  └─ Developer found it themselves?
│     → /grimoire:bug → reproduce first, write failing test, then fix
│
├─ "What could break? What are we missing?"
│  → /grimoire:bug-explore → exploratory testing, gap analysis, edge cases
│
├─ "I want to add / change / remove functionality"
│  │
│  ├─ Adding new behavior?
│  │  → /grimoire:draft → write new .feature file
│  │
│  ├─ Changing existing behavior?
│  │  → /grimoire:draft → modify existing .feature file
│  │
│  ├─ Removing a feature?
│  │  → /grimoire:remove → tracked removal with impact assessment
│  │
│  └─ Does it also involve a technology/architecture choice?
│     → Draft BOTH: .feature file + MADR decision record in the same change
│
├─ "We should use X instead of Y" / "How should we architect this?"
│  → /grimoire:draft → MADR decision record (not a feature)
│
├─ "We need to handle X concurrent users / meet Y compliance"
│  → /grimoire:draft → MADR decision record (non-functional requirement)
│
├─ "What do we have? What's documented?"
│  → /grimoire:audit → discover undocumented features and decisions
│
├─ "Is everything implemented correctly?"
│  → /grimoire:verify → check code matches specs
│
├─ "Refactor / clean up / reorganize"
│  → Don't use grimoire (no behavior change). UNLESS the refactoring
│    changes module boundaries or patterns — then write an ADR.
│
├─ "Update config / deps / formatting"
│  → Don't use grimoire. Just do it.
│
├─ "Setting up grimoire on an existing project"
│  1. `grimoire init` → creates .grimoire/ directory and config
│  2. `/grimoire:discover` → generates conventions files, data schema, project context (requires codebase-memory-mcp)
│  3. `/grimoire:audit` → discovers undocumented features and decisions
│  4. Start working: `/grimoire:draft` for new changes, `/grimoire:bug` for fixes
│
└─ "Setting up grimoire on a new/greenfield project"
   1. `grimoire init` → creates .grimoire/ directory and config
   2. Start working: `/grimoire:draft` for the first feature
```

### Skill Routing

Every grimoire skill has a **Routing** section that redirects to the correct skill when a mismatch is detected. If you start a skill and realize the user's request doesn't match, check the Routing section — it tells you where to go instead.

Skills also have a **Done** section that signals when the workflow is complete. When you reach it, present results and wait for the user's next instruction. Do not invent follow-up actions.

## Workflow: Creating or Changing a Feature

This is the end-to-end flow for the most common operation — adding or modifying behavior:

1. **User describes what they want**
2. **Draft** (`/grimoire:draft`): Qualify the request. Draft `.feature` files and/or ADRs. Write manifest. Collaborate until the user approves. Update manifest status to `approved`.
3. **Plan** (`/grimoire:plan`): Read approved artifacts. Generate `tasks.md` with red-green test pairs for each scenario. Review with user.
4. **Review** (`/grimoire:review`): *Optional.* Multi-persona design review — product manager (completeness), senior engineer (simplicity and feasibility), security engineer (vulnerabilities), QA engineer (testability and edge cases). Fix blockers before coding.
5. **Apply** (`/grimoire:apply`): Work through tasks. For each: write test (must fail), write code (must pass), mark done. Update manifest status to `implementing`.
6. **Verify** (`/grimoire:verify`): Confirm all scenarios pass, no regressions, decisions followed. Generate report.
7. **Archive** (`grimoire archive <id>`): Sync features/decisions to baseline. Archive manifest. Update manifest status to `complete`.

Each stage has a skill. The user drives the pace. In review mode (default), every file change is approved before writing. In autonomous mode, the agent works through the full task list, stopping only on blockers.

### IMPORTANT: tasks.md Is the Plan

When `tasks.md` exists for a change, it IS the plan. **Do not enter plan mode. Do not create your own plan. Do not re-derive tasks from the feature files.**

The plan was created in the plan stage with specific file paths, specific assertions, and specific implementation details. It was reviewed and approved by the user. The apply stage executes it — nothing more.

This matters because:
- The plan was written with full codebase context (real file paths, real patterns)
- The user already approved the approach
- Re-planning wastes time and may diverge from what was agreed
- `tasks.md` supports resume — a new session should pick up where the last one left off, not start over

If a task seems wrong or impossible during apply:
1. Flag it to the user with a specific explanation
2. Wait for the user to decide: fix the task, skip it, or go back to plan
3. Do NOT silently rewrite or reorder tasks

## Directory Structure

```
project-root/
├── features/                 # Gherkin baseline — behavioral truth
│   └── <capability>/
│       └── <name>.feature
├── .grimoire/
│   ├── decisions/            # MADR baseline — architectural truth
│   │   ├── 0001-short-title.md
│   │   └── template.md
│   ├── changes/              # proposed changes (in progress)
│   │   └── <change-id>/
│   │       ├── manifest.md
│   │       ├── tasks.md
│   │       ├── features/     # proposed .feature file state
│   │       └── decisions/    # new/updated ADRs
│   └── archive/              # completed changes (manifests only)
│       └── YYYY-MM-DD-<change-id>/
│           └── manifest.md
```

## Conventions

### Manifest Status Lifecycle
Every manifest has a `status` field in YAML frontmatter:
- `draft` — being written, not yet reviewed
- `approved` — reviewed by user, ready for planning/implementation
- `implementing` — tasks are being worked on
- `complete` — all tasks done, ready to archive

Update the status as the change progresses. The CLI reads this to report change state.

### Change IDs
- Kebab-case, verb-led: `add-two-factor-auth`, `update-login-flow`, `remove-legacy-api`
- Must be unique across active changes

### Branch Naming
Create a feature branch before implementing a change:
```
<type>/<change-id>
```
- `feat/add-two-factor-auth` — new feature
- `fix/handle-null-pricing` — bug fix
- `refactor/migrate-to-sqlalchemy` — refactoring
- `chore/update-dependencies` — maintenance

The branch name links the git history to the grimoire change. Update the manifest's `branch:` field when the branch is created.

### Commit Trailers
Every commit during a grimoire change **MUST** include a `Change:` git trailer:
```
feat(auth): add TOTP verification

Implement TOTP code verification using pyotp.

Change: add-2fa-login
Scenarios: "Login with valid TOTP code", "Login with expired TOTP code"
```

This is what makes `grimoire trace` and `grimoire log` work. Without it, the commit is invisible to the audit trail. `Scenarios:` and `Decisions:` trailers are included when relevant.

### Feature Organization
- One capability per directory: `features/auth/`, `features/documents/`
- One feature per file (or closely related features grouped)
- Tags for cross-cutting concerns: `@smoke`, `@api`, `@slow`

### Decision Numbering
- Sequential, zero-padded: `0001-`, `0002-`, etc.
- Never reuse numbers
- Superseded decisions keep their number, status updated to `superseded by NNNN`

### Step Definitions
Organize by **domain concept**, NOT by feature file. Check the project's existing test setup and match its BDD framework conventions. See the active skill's testing reference for ecosystem-specific patterns.


<!-- GRIMOIRE:START -->
## Caveman Mode

Respond terse like smart caveman at **lite** intensity. All technical substance stay. Only fluff die.

Rules: No filler/hedging. Keep articles + full sentences. Professional but tight.

Auto-clarity exception: revert to normal for security warnings, irreversible action confirmations, and multi-step sequences where fragments risk misread.

Boundaries: code, commits, PRs written normally. Stop with "stop caveman" or "normal mode".

<!-- caveman:lite — based on github.com/JuliusBrussee/caveman -->

<!-- GRIMOIRE:END -->
