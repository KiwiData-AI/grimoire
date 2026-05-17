---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
---

# One `grimoire-design` skill, not split (brand/design/figma)

## Context and Problem Statement

UI/UX workflow could decompose into multiple skills: `grimoire-brand` (token capture), `grimoire-design` (variant generation), `grimoire-figma` (MCP integration). Each could be invoked independently.

Should the workflow be one omnibus skill or multiple narrow skills?

## Decision Drivers

- Skill discoverability — too many skills clutter the trigger surface
- Designer mental model — they think "I'm doing design work," not "I'm running the brand sub-workflow"
- Existing grimoire pattern — `grimoire-draft` covers both feature and decision drafting in one skill
- Consult mode is genuinely different (no artifact production, just Q&A) → already separated as `grimoire-design-consult`
- Brand capture happens at onboarding, not as a recurring design task → belongs in `grimoire-discover`/`init`, not a standalone skill

## Considered Options

1. **One `grimoire-design` skill + brand capture in onboarding + separate `grimoire-design-consult`** (current proposal)
2. **Three skills:** `grimoire-brand`, `grimoire-design`, `grimoire-figma`
3. **One mega-skill:** `grimoire-design` covers brand, designs, Figma integration, AND consult

## Decision Outcome

Chosen option: **Option 1**.

`grimoire-design` is one skill covering interactive design generation, variant proposal, state enumeration, and Gherkin scenario derivation. Brand capture lives in onboarding (`grimoire-discover` + `init.ts`). Consult mode is `grimoire-design-consult` because its surface (Q&A, no artifacts) is materially different.

Brand-drift lint is a *mode* of `grimoire-design` (`grimoire-design --lint`), not a separate skill — same artifact (tokens.json), same skill, different verb.

### Consequences

- Good: Designer learns one verb (`design`) for the recurring task
- Good: Onboarding stays the one-shot setup it already is
- Good: Mirrors existing `grimoire-draft` pattern (multiple artifact types in one skill)
- Good: `grimoire-design-consult` separation justified by surface difference (no artifacts produced)
- Bad: `grimoire-design` SKILL.md will be longer than narrow alternatives
- Bad: Brand-lint as a mode is slightly hidden — discoverability via `--lint` flag

### Confirmation

If users in practice can articulate when to invoke `grimoire-design` vs `grimoire-design-consult` without a decision tree, the split is correct. If users routinely confuse "which design skill," reconsider in v2.
