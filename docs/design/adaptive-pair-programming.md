# Planned Review Timing and Tactical Verification

**Status:** Proposed

**Scope:** Portable Grimoire planning, implementation, review, and verification.

## Problem

File-level and section-level approval mechanics consume implementation time without matching review importance. Technical micro-sections also create excessive agent ceremony. Broad test commands inside every section repeat expensive setup and full-suite work.

Gherkin has also expanded into implementation nuances that are not actor-visible behavior. This makes feature files longer without improving behavioral truth.

## Goals

- Default plans to one or two substantial sections.
- Assign activity-level review timing during planning.
- Review costly structure before implementation.
- Let ordinary activities implement autonomously.
- Use exact tactical red-green commands during implementation.
- Run one `grimoire-verify` procedure after implementation.
- Run one pre-commit review and one final suite run inside verification.
- Preserve optional harness-level per-file review.
- Treat Gherkin as optional.
- Adapt immediately to useful user steering.

## Non-Goals

- Add provider-specific patch or review state.
- Remove strict red-green proof.
- Remove baseline or final regression coverage.
- Add a test runner or infer unsupported acceleration flags.
- Encode per-file review in `tasks.md`.

## Artifact Routing

Gherkin is reserved for clear actor-visible behavior. Prefer extending an existing feature when its actor and capability already match.

Internal optimizations, refactors, configuration, protocols, and implementation details use unit, characterization, contract, benchmark, constraint, or ADR verification. A valid change can have no Gherkin edits.

## Planning Contract

Plans use one substantial implementation section by default. A second section requires a distinct outcome or context boundary. Every section beyond two requires a specific outcome, dependency, or context-boundary justification.

Each implementation activity is one vertical checkbox containing:

- The new or changed test and exact assertion.
- The production change required by that test.
- One exact tactical command used for red and green.
- One review marker immediately below the checkbox.

```markdown
- [ ] 1.1 (verify: scenario) Complete successful TOTP login.
      <!-- review: structure-before -->
      - Test: add exact redirect and session assertions.
      - Implement: add the model, migration, and view behavior.
      - Red/green: `pytest tests/auth/test_totp.py -k valid_totp --reuse-db`.
```

The tactical command selects only the new or changed tests. It uses an accelerator only when project configuration or existing commands prove support. Examples include Django `--keepdb` and pytest-django `--reuse-db`.

Final verification is not a task section or checkbox.

## Review Timing

### Structure Before

Use `structure-before` for costly-to-reverse shapes:

- Data models, relationships, constraints, indexes, and nullability.
- Repository layout and ownership boundaries.
- Public interfaces, contracts, and dependency direction.
- DRY-sensitive or performance-sensitive design.
- Transactions, queues, retries, concurrency, and external boundaries.

The user reviews the intended production shape once. Approval allows direct autonomous tactical implementation. File boundaries create no additional gate.

### Slice After

Use `slice-after` when the agent may implement directly. The activity has no intermediate human gate. Its complete diff joins the consolidated pre-commit review during `grimoire-verify`.

Optional harness-level per-file review remains available when the user requests it. Grimoire stores no provider-specific per-file state.

## Apply Lifecycle

### Baseline

Apply runs every configured test suite once before code changes. It records accepted failures in `baseline.md`. A failure is pre-existing only when the baseline contains it.

### Tactical Red-Green

For each activity:

1. Load a fresh implementation context for the substantial section.
2. Perform the planned `structure-before` review when required.
3. Write or change the task's test.
4. Run the exact tactical command.
5. Accept red only when behavior is absent.
6. Diagnose collection, import, fixture, syntax, or infrastructure failures.
7. Implement the production change directly.
8. Run the same tactical command until green.
9. Mark the checkbox complete immediately.

`slice-after` adds no intermediate pause.

### User Steering

Apply a user correction immediately. Record one terse implementation lesson only when remaining work changes. Update only affected unchecked tasks and rerun their tactical tests.

Do not add a checkpoint, report, approval, persona rerun, or plan-wide reconciliation. The agent still asks before changing direction without user guidance.

Retry limits, circuit breakers, destructive-operation permissions, and specification-conflict handling remain unchanged.

## Verify Lifecycle

After every implementation activity is green, apply invokes one `grimoire-verify` procedure.

Verification runs in this order:

1. Validate Grimoire artifacts.
2. Run Grimoire-specific static verification.
3. Run configured deterministic non-test checks by explicit step name.
4. Invoke one pre-commit review over the complete diff using only relevant personas.
5. Apply one accepted correction batch.
6. Rerun only affected tactical tests and applicable deterministic checks.
7. Run one final suite run covering every configured unit and BDD suite.
8. Compare every failure with `baseline.md` and block new failures.

The pre-commit review is the single general code and best-practice review. Verification does not separately run an LLM-backed `best_practices` check.

## Session and Resume Rules

Each substantial section uses one fresh implementation context. Task checkboxes are the resume state. A session handoff records completed task IDs, changed ownership, and facts needed by later sections.

Failure-mode notes prevent repeated attempts. Implementation lessons carry user corrections only while they affect unchecked work. Durable discovered facts move to their existing authoritative home during finalization.

## Acceptance Criteria

- Plans use substantial sections and activity-level review timing.
- Each vertical task has one exact tactical red-green command.
- `structure-before` reviews shape once before autonomous implementation.
- `slice-after` has no intermediate human gate.
- Apply runs full suites only for baseline.
- Apply invokes one `grimoire-verify` procedure after tactical work.
- Verify runs one pre-commit review and one final suite run.
- Gherkin remains optional and limited to clear actor-visible behavior.
- Harness-level per-file review remains outside Grimoire state.
