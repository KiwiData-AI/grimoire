---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Use fresh subagents per task section in grimoire-apply

## Context and Problem Statement
The apply skill implements multiple tasks sequentially. As implementation progresses, the AI's context window fills with prior code, test output, and debugging — causing context rot that degrades quality on later tasks. How should grimoire manage context across a multi-task implementation session?

## Decision Drivers
- Later tasks must get the same quality as early tasks
- Interrupted sessions must be resumable without losing progress
- Task coordination must survive agent restarts
- Token cost should be proportional to task complexity, not cumulative

## Considered Options
1. Subagent-per-section — parent orchestrator spawns fresh child agents for each task group
2. Single session — one long conversation handles all tasks
3. Checkpoint/resume — periodically save state and restart with compressed context
4. Tool-based state — offload all state to files, keep conversation minimal

## Decision Outcome
Chosen option: "Subagent-per-section", because each child agent starts with a fresh context window containing only the relevant `<!-- context: ... -->` block from `tasks.md`. The parent orchestrator reads `tasks.md` checkboxes to track progress and spawn the next section. If interrupted, any agent can resume by reading `tasks.md` state.

### Consequences
- Good: Each task section gets full context window quality
- Good: `tasks.md` serves as durable coordination — survives crashes, agent switches, user breaks
- Good: Token cost scales with task complexity, not total change size
- Good: Natural parallelism boundary (sections could run concurrently in future)
- Bad: Overhead of spawning subagents (agent startup cost per section)
- Bad: Cross-task context is lost — later tasks can't reference earlier debugging
- Bad: Requires `<!-- context: -->` blocks to be accurate (stale blocks cause wrong files read)

### Confirmation
If a 10+ task implementation maintains consistent code quality between the first and last tasks, and an interrupted session resumes correctly from `tasks.md`, the decision is validated.
