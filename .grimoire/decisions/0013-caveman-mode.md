---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Caveman mode for token-optimized AGENTS.md

## Context and Problem Statement
AGENTS.md contains detailed workflow instructions that consume significant context window tokens. Smaller models or constrained contexts may not have room for full instructions alongside the user's code. How should grimoire handle varying context budgets?

## Decision Drivers
- Full instructions are essential for first-time or complex workflows
- Experienced users and capable models need less hand-holding
- Token cost directly affects response quality (less room for code = worse output)
- Must be a project-level setting (not per-invocation)

## Considered Options
1. Caveman levels — four verbosity tiers (none, lite, full, ultra) set in config
2. Single compact mode — one alternative short version
3. Dynamic compression — detect available context and adapt
4. Separate agent instructions — different AGENTS.md per agent capability

## Decision Outcome
Chosen option: "Caveman levels", because different projects have different context budgets and the right verbosity depends on team experience. `none` gives full instructions, `lite` trims explanations while keeping the workflow, `full` strips to essentials, and `ultra` is a bare skeleton. Set via `project.caveman` in config and applied during `grimoire init` / `grimoire update`.

### Consequences
- Good: Projects can tune instruction size to their context budget
- Good: Experienced teams skip verbose explanations
- Good: Ultra mode enables grimoire on very small context models
- Bad: Four levels to maintain across AGENTS.md template changes
- Bad: Users on higher caveman levels may miss nuanced workflow rules
- Bad: Caveman level affects all agents equally — can't give one agent more detail

### Confirmation
If a project on `caveman: full` produces correct workflow behavior with significantly fewer AGENTS.md tokens than `caveman: none`, the decision is validated.
