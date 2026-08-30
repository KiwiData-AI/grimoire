---
status: accepted
date: 2026-08-29
decision-makers: [Fred]
---

# Adapt implementation review by task section

## Context and Problem Statement

Grimoire currently applies a single review or autonomous strategy to a whole change. Review mode asks for approval by file, while autonomous mode cannot reserve architecture and pattern-establishing work for collaboration. A task section already defines a coherent implementation boundary and persists across resumed sessions. Grimoire must support adaptive review without creating provider-specific workflow dependencies or new Git isolation mechanisms.

## Decision Drivers

- Review decisions with high downstream leverage before production code changes.
- Permit autonomous execution for established repetition.
- Preserve approved `tasks.md`, red-green, retry, circuit-breaker, branch, and worktree rules.
- Keep the workflow portable across Claude, Codex, OpenCode, and compatible agents.
- Review the complete staged index before the final commit or pull request.
- Keep checkpoint state limited to sections that the plan declares as paired.
- Bind final approval to one complete ordinary Git index without parallel review state.

## Considered Options

1. Per-section execution metadata with structure and slice checkpoints.
2. Existing whole-change review or autonomous mode.
3. File-by-file production approval.
4. A provider-specific review service, worktree, or synthetic staging workflow.

## Decision Outcome

Chosen option: "Per-section execution metadata with structure and slice checkpoints", because task sections are the existing coherent, resumable unit of work. Each section declares `execution: paired | autonomous`. Only paired sections may declare checkpoints; autonomous sections declare `checkpoints: none`. Runtime state in `tasks.md` records user overrides without changing the approved strategy.

`structure-before` occurs before support or production implementation. `slice-after` is a one-time checkpoint for the first representative verified production increment. Tasks covered by that increment remain incomplete until the slice is approved. A rejected slice remains provisionally applied while a fresh paired agent returns an unapplied corrective patch. The workflow does not require rollback or direct production edits by that agent. Once approved or waived, `slice-after` does not recur for later increments.

A paired agent writes the failing support test and returns an unapplied production patch. Rejection leaves production unchanged, retains the red test, and redispatches the same section with revision feedback. Approval allows the orchestrator to apply the patch and run focused verification.

Ordinary mid-process commits require only the `Change:` trailer. Before finalization removes ephemeral state, at least one ordinary commit carries the current change identity and durable verified work only. It excludes active change-folder scaffolding. Documentation is regenerated after removal, and all durable changes are staged in one ordinary Git index. The user reviews every staged path, classified as production or support, and the full target-branch-merge-base-to-index diff without exclusions. Approval is followed immediately by one final commit carrying `Change:` and `Final-production-review: approved`. There is no review snapshot, digest, synthetic ref, synthetic index, review worktree, or cleanup-only commit.

The workflow remains Markdown and Git based. Finalization can resume from ordinary Git state, and PR generation uses Git history and changed live artifacts after cleanup.

### Consequences

- Good: High-leverage structure and the first repeated slice receive focused collaborative review.
- Good: Mechanical repetition can proceed without file-level interruptions.
- Good: Runtime overrides survive resume and preserve the approved plan.
- Good: Rejected unapplied patches retain the red test as executable revision guidance.
- Good: Rejected provisional slices revise forward through a fresh paired agent without rollback.
- Good: Covered tasks cannot appear complete before the one-time slice is approved.
- Good: The final review covers the complete merge-base-to-index production and support change.
- Good: Final-review approval remains auditable after ephemeral change state is removed.
- Bad: Planning requires an explicit strategy table for every implementation section.
- Bad: Agent integrations must honor the metadata and safe-boundary semantics.

### Cost of Ownership

- **Maintenance burden**: Keep the metadata grammar and checkpoint semantics consistent in plan, apply, commit, PR, documentation, and workflow features.
- **Ongoing benefits**: Fewer low-value approvals and clearer review boundaries without a new runtime dependency.
- **Sunset criteria**: Revisit if provider adapters cannot consistently honor the Markdown contract or a concrete review surface provides material value without owning workflow state.

### Confirmation

- The workflow feature specifications describe paired-only checkpoints, forward rejection revision, one-time slice approval, and complete-index finalization.
- The plan and apply skills describe the same metadata grammar and checkpoint lifecycle.
- `src/core/skill-contracts.test.ts` deterministically verifies paired dispatch, checkpoint transitions, ordinary commits, and one final-review commit.
- Pull request coverage verifies generation from Git history and changed live artifacts after cleanup.
- `npm run test:bdd` and `npm test -- --run` pass.
