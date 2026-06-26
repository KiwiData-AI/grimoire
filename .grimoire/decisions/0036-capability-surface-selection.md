---
status: accepted
date: 2026-06-26
decision-makers: [kiwi-data]
---

# Capability-surface selection: where a new capability belongs

## Context and Problem Statement
Grimoire is a focused spec-driven dev framework, not a general agent OS. Every new capability
invites a default reflex — "make it a skill" or "wrap it in an MCP server" — and unchecked, that
reflex is how a focused tool becomes a sprawling one (the ECC review surfaced 271 skills / 69
agents as the failure mode). There is no written gate today for deciding *where* a capability
should live, so the question gets answered ad hoc per contribution.

Each surface has a real cost. MCP tool schemas load into every session and tax the context window
whether used or not. Skills fire probabilistically and add to the routable surface. CLI commands
are deterministic but carry TS + test weight. A rule in AGENTS.md is free at rest but only works
for always-on deterministic guidance.

## Decision Drivers
- Stay focused — resist agent-OS sprawl ([0010] skills-as-pure-markdown set the lean baseline).
- Context cost — MCP schemas are paid on every session ([0030], [0032] govern MCP use).
- One home per fact — a capability in the wrong surface duplicates or fragments behavior.
- Lowest-surface bias — prefer the smallest runtime footprint that holds.

## Considered Options
1. No policy — decide per contribution (status quo).
2. An ordered surface-selection rule contributors apply before adding a capability.

## Decision Outcome
Chosen option: "an ordered surface-selection rule", because a written gate is the structural
antidote to sprawl and makes "should this even be a skill?" answerable consistently.

Apply the first rung that holds:

1. **Deterministic, always-on guidance** → an AGENTS.md rule (free at rest, no routing surface).
2. **On-demand human-in-the-loop workflow** → a skill (`skills/<name>/SKILL.md`).
3. **One-shot deterministic work** (checks, tracing, generation, validation) → a CLI command /
   script in `src/`.
4. **Structured, stateful, cross-client tool** → MCP — **only when the capability is universal
   AND stateful**, where the server boundary clearly pays for its per-session schema cost. A
   connector that merely wraps a CLI does not qualify.
5. **Heavy rubric / catalog / reference content** → a `skills/references/*.md` file loaded on
   demand, not inlined into a SKILL.md.

Bias to the smaller surface; promote to a heavier one only when the lighter one demonstrably
fails. Codebase structure stays on codebase-memory-mcp ([0029]) — this rule governs *new*
capabilities, not that established engine.

### Consequences
- Good: a consistent, lean default; contributors and reviewers have one gate to cite; sprawl is
  resisted by construction.
- Good: keeps MCP surface minimal, protecting every user's context budget.
- Bad: a small judgement step before adding a capability; edge cases will still need a call.

### Cost of Ownership
- **Maintenance burden**: one short ADR + a CONTRIBUTING pointer; no code.
- **Ongoing benefits**: prevents the highest-cost form of scope creep (unbounded skill/MCP growth).
- **Sunset criteria**: revisit if grimoire's scope deliberately broadens beyond focused dev.

### Confirmation
A new skill, MCP connector, or CLI command added without citing the rung it satisfies is a
review finding (Senior Engineer persona). The Senior Engineer "Unrecorded decision" check
(`skills/references/review-personas.md` §4.2) covers the inverse — a surface choice made
without recording the decision.
