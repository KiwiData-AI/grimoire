# Adaptive Pair Programming for Grimoire Apply

**Status:** Proposed

**Scope:** Upstream Grimoire workflow changes, global OpenCode configuration,
and a deferred optional Seance integration.

## Problem

Grimoire review mode currently asks for approval before each production-file
edit. File boundaries rarely align with meaningful design or behavior
boundaries. This produces low-value interruptions.

Grimoire autonomous mode applies to an entire change. It cannot reserve model
design, module organization, or a new implementation pattern for collaborative
review while allowing mechanical repetition to proceed independently.

OpenCode currently exposes too many visible agent states. Switching among them
is inconvenient. The default workflow should feel like a focused coding CLI:
plan, pair, or build.

## Goals

- Agree review and execution strategy during planning.
- Pair on decisions with high downstream leverage.
- Execute established repeated work autonomously.
- Review coherent production increments rather than individual files.
- Keep test, Gherkin, and Grimoire coordination edits out of normal review.
- Permit a user to change the current section's execution strategy at runtime.
- Use the current branch or existing worktree without creating review worktrees.
- Commit at normal logical boundaries.
- Review a complete production-only diff before finalization or a pull request.
- Keep Seance optional while it remains alpha.

## Non-Goals

- Do not create a synthetic staging workflow, patch queue, or review worktree.
- Do not require approval before a section starts.
- Do not require approval for every production file.
- Do not expose tests and specifications unless requested or needed to diagnose a failure.
- Do not replace `tasks.md` as the implementation authority.
- Do not make Seance a required dependency or workflow state machine.
- Do not change Git commit, branch, or worktree behavior.

## Terms

**Section**
: A `## N. Name` task group in `tasks.md`.

**Production edit**
: An edit that affects shipped runtime behavior, a migration, build behavior,
or deployed configuration.

**Support edit**
: A test, Gherkin feature, Grimoire coordination artifact, baseline, or
learning record.

**Production increment**
: A coherent architectural or behavioral change that can span multiple
production files.

**Pattern establishment**
: The first implementation that sets a convention repeated by later work.

**Repetition**
: Work that follows an approved local pattern without adding a design choice.

**Paired execution**
: A section where a production increment is reviewed before its application.

**Autonomous execution**
: A section where an implementation agent may edit production files directly.

## Planning Contract

Every implementation section receives two independent metadata fields. The
planner presents the complete strategy table with `tasks.md` for user approval.

```markdown
## 2. Establish document synchronization

<!-- execution: paired -->
<!-- checkpoints: structure-before,slice-after -->
<!-- context:
  dais/tasks.py
  ext_lib/typesense_search.py
-->
```

```markdown
## 3. Apply synchronization to remaining callers

<!-- execution: autonomous -->
<!-- checkpoints: none -->
```

### Metadata Grammar

```text
execution   = paired | autonomous
checkpoints = none | structure-before | slice-after |
              structure-before,slice-after
```

Rules:

- Every implementation section declares `execution` and `checkpoints`.
- `none` is exclusive.
- Checkpoint order is `structure-before,slice-after`.
- Verification-only sections default to `autonomous` and `none`.
- The plan separates pattern establishment from later repetition.
- The plan groups work by coherent outcome, never by file count.

### Planner Defaults

The planner proposes `paired` with `structure-before` for sections that change:

- Models, migrations, relationships, constraints, nullability, or indexes.
- Public request, response, event, or persistence structures.
- Module ownership, public interfaces, or dependency boundaries.
- Transaction, queue, retry, concurrency, or external-service contracts.

The planner proposes `paired` with `slice-after` for the first use of a
pattern that later sections repeat.

The planner proposes `autonomous` with `none` for mechanical propagation,
renames, import updates, and other work that follows an approved pattern.

The planner can propose `autonomous` with a checkpoint when independent
implementation remains appropriate but a high-risk design or completed slice
still needs review.

### Strategy Review

The plan presents a table like this before approval:

| Section | Execution | Checkpoints | Reason |
|---|---|---|---|
| Define the ownership model | paired | structure-before | High-leverage relationship decision |
| Implement one sync path | paired | slice-after | Establishes the repeated pattern |
| Update remaining callers | autonomous | none | Mechanical propagation |
| Run verification | autonomous | none | No design choice |

The user can change any proposed value before approving the plan.

## Checkpoint Semantics

### Structure Before

`structure-before` pauses before tests or production implementation.

The review presents a small, unapplied production shape proposal containing:

- Intended production files and ownership boundaries.
- Model fields, relationships, constraints, indexes, and nullability.
- Function, class, protocol, and payload signatures.
- Imports that reveal dependencies.
- Transaction, queue, retry, or external-boundary behavior.
- Existing project patterns reused.
- Material alternatives and the selected trade-off.

The checkpoint validates implementation shape. It does not approve omitted
implementation detail.

### Slice After

`slice-after` pauses after one representative production increment is complete
and focused verification has run.

The review presents:

- One production-only multi-file diff.
- The implemented behavior and its entry point.
- The persistence, task, or external-service boundary when relevant.
- Focused verification results.
- Any divergence from the approved structure.
- The pattern proposed for remaining sections.

The user may request revision, continue paired execution, or direct the agent
to finish the remaining section autonomously.

### No Checkpoint

`none` permits uninterrupted execution. Existing blocker, specification
conflict, test-failure, and circuit-breaker rules still apply.

## Runtime Overrides

The user may change the current section's effective strategy without changing
the approved plan.

| User instruction | Result |
|---|---|
| `Finish this section on your own` | Switch to autonomous; retain pending checkpoints |
| `Finish without further review` | Switch to autonomous; waive pending checkpoints |
| `Pair with me from here` | Switch to paired at the next safe production boundary |
| `Show me the next slice` | Continue until the next pending checkpoint |

Apply records the effective state below the section metadata:

```markdown
<!-- runtime-execution: autonomous -->
<!-- checkpoint-state: structure-before=approved,slice-after=pending -->
```

Allowed checkpoint states are `pending`, `approved`, and `waived`.

Runtime metadata belongs to the ephemeral `tasks.md` coordination record. It
survives session resume and is removed when the change is finalized.

An execution switch takes effect at the next safe production boundary. An
active subagent returns before replacement. Completed work is never rewritten
by a runtime override.

## Apply Behavior

### Paired Section

1. The primary agent starts the approved section automatically.
2. It presents `structure-before` when declared.
3. After approval, the paired section agent makes support edits and establishes
   the failing test.
4. The primary agent confirms the test is red.
5. The paired section agent returns an exact production patch for one coherent
   increment.
6. The primary agent presents and applies that patch after user approval.
7. The primary agent runs focused verification.
8. The primary agent presents `slice-after` when declared.
9. The section continues paired or switches to autonomous according to user
   instruction and remaining metadata.

One paired approval may cover multiple production files. File boundaries never
create a checkpoint by themselves.

### Autonomous Section

1. The primary agent starts the approved section automatically.
2. The autonomous section agent performs red-green implementation directly.
3. It stops at declared checkpoints, blockers, specification conflicts, or
   existing circuit breakers.
4. The primary agent verifies `tasks.md`, the relevant diff, and test output.
5. The primary agent starts the next section automatically.

## Git and Workspace Rules

- Use the branch and worktree already selected by the user.
- Do not create a worktree to isolate a checkpoint.
- Do not use a stash, synthetic branch, or artificial index state as a review
  mechanism.
- Make normal logical commits when appropriate.
- Scope a slice review to the current section's declared production paths.
- Include cumulative uncommitted changes when they overlap those paths.
- Never modify unrelated user work to produce a cleaner review.

### Final Production Review

Before finalization, commit, or pull-request creation:

1. Determine the target branch merge base.
2. Identify production paths from the approved plan.
3. Treat unknown changed non-support paths as production until classified.
4. Stage intended outstanding production changes using normal Git behavior.
5. Confirm no intended production change is untracked or unstaged.
6. Present the aggregate merge-base-to-index production diff.
7. Exclude tests, Gherkin, and ephemeral coordination files by default.
8. Require explicit user approval before the final commit or pull request.

The final review is a safety net. It includes both committed branch changes and
the staged outstanding increment. It does not replace earlier structural or
slice checkpoints.

## OpenCode Design

### Visible States

OpenCode exposes only three primary states in the tab cycle.

| State | Purpose | Normal behavior |
|---|---|---|
| `plan` | Read-only investigation and collaborative planning | No edits |
| `pair` | Reviewed implementation and Grimoire orchestration | Production increments ask; support work proceeds |
| `build` | Autonomous implementation | Edits proceed; consequential operations ask |

`pair` is the default state for new sessions.

The `pair` state does not override approved Grimoire section metadata. The
`build` state does not waive planned checkpoints. Runtime directives recorded
in `tasks.md` remain the only way to change an active section's strategy.

### Hidden Specialists

Review, QA, test, investigation, design research, and section agents run only
as hidden subagents or command targets. They do not appear in the primary tab
cycle.

Existing `reviewable-build` is retired after migration. It is replaced by the
visible `pair` state and hidden section agents.

### Pair State

The `pair` state:

- Runs the adaptive Grimoire apply workflow.
- Starts approved sections automatically.
- Dispatches the paired or autonomous section agent.
- Presents structure and slice checkpoints.
- Applies approved paired production patches in the primary session.
- Runs focused verification and the final production-only review.
- Allows support-file edits and normal local verification commands.
- Asks before commits, pushes, publishing, deployment, destructive commands,
  history rewriting, privilege changes, and remote access.

### Build State

The `build` state allows ordinary local edits, tests, linting, formatting
checks, and Git inspection without interruption.

It still asks before:

- File deletion and permission changes.
- Process termination.
- Git reset, clean, checkout, restore, rebase, merge, and other history or
  branch-destructive actions.
- Commit and push.
- Publishing, deployment, infrastructure changes, remote shells, or commands
  that use credentials.

Known local development and test commands, including suitable Docker test
commands, should not require approval solely because they use Docker.

### Paired Section Agent

The hidden paired section agent:

- Works on one named section only.
- May edit support files.
- Cannot edit production files.
- Cannot mutate production files through Bash, scripts, redirects, or a
  formatter.
- Returns exact unified production patches for the primary agent to review and
  apply.
- Cannot invoke other agents, commit, push, or perform destructive Git work.

### Autonomous Section Agent

The hidden autonomous section agent:

- Works on one named section only.
- May edit production and support files.
- Follows section checkpoints and existing failure breakers.
- Cannot invoke other agents, commit, push, publish, deploy, or perform
  destructive Git work.

### Command Routing

Interactive Grimoire commands use the visible `pair` state:

- `/implement`
- `/grimoire:apply`
- `/grimoire:draft`
- `/grimoire:plan`
- `/grimoire:design`
- `/grimoire:bug`
- `/grimoire:remove`
- `/grimoire:commit`
- `/grimoire:pr`

Read-only review, investigation, QA, verification, and vulnerability commands
use hidden specialist agents.

## Responsibility Matrix

| Responsibility | Grimoire | OpenCode primary | Section agent | Git | Seance |
|---|---|---|---|---|---|
| Approve plan strategy | Defines | Presents | No | No | No |
| Store section strategy | Yes | Updates runtime state | Reports | No | No |
| Produce production patch | No | Applies paired patch | Proposes or applies | No | Future review only |
| Run tests and checks | Defines | Runs and reports | Runs as delegated | No | No |
| Create commits | Requires trailers | Requests approval | No | Records history | No |
| Render review | Defines checkpoint intent | Presents patch | No | Supplies diff | Deferred option |
| Own workflow state | Yes | Current runtime state | No | Branch state | No |

## Grimoire Implementation Workstream

The upstream Grimoire repository implements this contract first.

Expected files:

```text
skills/grimoire-plan/SKILL.md
skills/grimoire-apply/SKILL.md
skills/grimoire-commit/SKILL.md
skills/grimoire-remove/SKILL.md
features/workflow/plan-the-work.feature
features/workflow/build-test-first.feature
AGENTS.md
README.md
docs/design/adaptive-pair-programming.md
```

The implementation should add an architecture decision record after design
approval. Existing decisions remain valid:

- ADR 0009: fresh subagents per task section.
- ADR 0031: live branch edits and Git as the staging and history mechanism.
- ADR 0035: autonomous failure limits and cross-section circuit breakers.

The new decision extends these decisions. It does not supersede them.

Grimoire skill changes must preserve the current red-green discipline, approved
`tasks.md` authority, and resume behavior.

## Global OpenCode Configuration Workstream

After Grimoire support is implemented and tested, configure global OpenCode.

Expected files:

```text
~/.config/opencode/opencode.jsonc
~/.config/opencode/agents/pair.md
~/.config/opencode/agents/grimoire-paired-section.md
~/.config/opencode/agents/grimoire-autonomous-section.md
~/.config/opencode/agents/design.md
~/.config/opencode/agents/review.md
~/.config/opencode/agents/test.md
~/.config/opencode/agents/investigate.md
~/.config/opencode/agents/qa.md
~/.config/opencode/commands/*.md
```

The migration retires:

```text
~/.config/opencode/agents/reviewable-build.md
```

The configuration sets `default_agent` to `pair`. It makes specialist agents
hidden subagents and limits their permissions to their stated responsibilities.

Automatic formatters must not silently alter a reviewed production patch. Run
formatters as explicit checked or reviewed operations.

OpenCode must restart after configuration changes.

## Acceptance Criteria

### Grimoire

- Every implementation section includes valid execution and checkpoint metadata.
- Planning presents the complete strategy table before approval.
- Planning separates pattern establishment from repetition.
- `structure-before` occurs before tests and production implementation.
- `slice-after` presents one production increment and focused verification.
- Runtime overrides persist in `tasks.md` and survive resume.
- Rejected paired patches leave production files unchanged.
- Existing red-green, retry, and circuit-breaker behavior remains active.
- Apply creates no review worktree or synthetic staging workflow.
- Final review includes intended committed and staged production changes.
- Final review excludes support edits by default.

### OpenCode

- Only `plan`, `pair`, and `build` appear as visible primary states.
- New sessions start in `pair`.
- A paired section agent cannot edit production through editor or shell tools.
- A paired section agent can edit test, Gherkin, and coordination files.
- An autonomous section agent can edit production but cannot commit or delegate.
- Normal local tests and checks do not require approval in `pair` or `build`.
- Consequential and destructive operations remain permission-gated.
- A multi-file paired increment displays in the primary session before use.
- Switching tabs does not silently change approved section metadata.

## Rollout

1. Review this document.
2. Draft and approve the Grimoire architecture decision and implementation plan.
3. Implement and verify upstream Grimoire support.
4. Update installed Grimoire skills in a test project.
5. Configure global OpenCode agents and commands.
6. Restart OpenCode.
7. Test paired and autonomous sections in a disposable fixture repository.
8. Use the workflow on several real changes.
9. Record checkpoint overrides, rejected patches, permission failures, and
   recovery events.
10. Revisit planning defaults after observed use.

## Deferred Seance Integration

Seance is excluded from the initial implementation because it remains alpha.

OpenCode-native pairing must first prove the workflow without a new dependency.
If later needed, Seance may provide a local review surface for exact patch
bundles. It must remain stateless regarding Grimoire task progression, OpenCode
execution mode, Git staging, commits, branches, and worktrees.

A future interface may use this contract:

```text
ReviewRequest
  kind: structure | increment | slice | final
  section
  unified patch
  rationale
  base revision

ReviewOutcome
  accept | edit | reject
  optional revised patch
  optional note
```

The primary OpenCode agent remains responsible for validating any Seance output
and applying changes. Seance unavailability must not block the Grimoire or
OpenCode workflow.

## Risks and Recovery

- Planning may classify routine work as paired or novel work as autonomous.
  The user corrects the strategy table before approval.
- A production patch can become stale before primary application. Regenerate it
  from current files rather than applying it partially.
- Large sections can conceal several decisions. Split the section during
  planning rather than add file-level review.
- Production-path classification can miss unconventional runtime files. Treat
  unknown non-support changes as production.
- A runtime override can arrive while a subagent is active. The subagent returns
  before the effective strategy changes.
- Instruction-level enforcement can be bypassed by a poorly configured agent.
  Agent permissions and the final production review provide defense in depth.
- Existing user changes can overlap a section. Preserve them and disclose the
  cumulative overlap in the checkpoint review.
