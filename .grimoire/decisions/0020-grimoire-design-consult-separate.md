---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
---

# `grimoire-design-consult` is a separate skill, not a flag on `grimoire-review`

## Context and Problem Statement

Designers want technical (security, data) review *before* doing a full design pass — to surface concerns that engineering would catch late. The existing `grimoire-review` skill runs personas against produced artifacts (manifest, features, decisions, tasks).

Should this designer-friendly pre-design consult be a flag on `grimoire-review` (`--consult`, `--no-artifacts`) or a separate skill?

## Decision Drivers

- Designer audience won't intuit `grimoire-review --consult` from documentation
- Surface is materially different: no artifacts required, output is conversational Q&A, results become assumptions not findings
- `grimoire-review` invariant (artifacts must exist) would need exception
- Consult mode could later evolve independently (e.g., richer elicitation, persona-driven question generation)

## Considered Options

1. **Separate skill `grimoire-design-consult`** (proposal)
2. **Flag on review:** `grimoire-review --consult`
3. **New mode of `grimoire-draft`:** consult as a pre-step inside drafting

## Decision Outcome

Chosen option: **Option 1**.

`grimoire-design-consult` is a standalone skill that:
- Takes minimal input: problem statement (and optionally proposed user flow)
- Runs Security Engineer + Data Engineer personas (default; user can add others) in **Q&A mode**, not findings mode
- Personas ask clarifying questions of the designer rather than producing blocker/suggestion findings
- Outputs an `.grimoire/changes/<id>/consult.md` file w/ Q&A transcript and inferred assumptions/givens
- Hands off: assumptions populate `manifest.md` Assumptions section when designer later runs `grimoire-design` or `grimoire-draft`

### Consequences

- Good: Clear designer-facing verb (`consult`) — easier to teach than `review --consult`
- Good: Preserves `grimoire-review` invariant (artifacts required)
- Good: Output format (Q&A transcript → assumptions) is incompatible with review's blocker/suggestion structure anyway
- Good: Engineers can use it too — "I'm thinking about adding X, what should I worry about?" is universal
- Bad: One more skill in the inventory (now 21)
- Bad: Duplicates persona loading logic from `grimoire-review` — mitigate via shared references

### Confirmation

If designers in practice run `grimoire-design-consult` before any artifact creation, and the resulting assumptions show up in later `grimoire-design`/`grimoire-draft` manifests, the separation is correct.
