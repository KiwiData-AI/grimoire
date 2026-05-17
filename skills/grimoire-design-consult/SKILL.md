---
name: grimoire-design-consult
description: Pre-design technical consult. Security and data personas interview the designer (or engineer) about a proposed change before any artifacts exist, surfacing assumptions and constraints early. Use before grimoire-design or grimoire-draft when the change might touch sensitive data, compliance, or risky surfaces.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-design-consult

A **pre-design Q&A** with security and data personas. The designer brings a problem statement; the personas ask clarifying questions; the skill distills the transcript into assumptions, givens, and open questions that downstream `grimoire-design` and `grimoire-draft` consume.

This is **not** a review. No artifacts are required to exist. No blocker/suggestion findings are produced. The output is a conversation transcript plus inferred constraints.

## Triggers
- User says "consult", "tech check", "tech check this idea", "should I ...", "what should I worry about", or "before designing"
- User wants security or data sign-off on an idea before investing in design work
- Loose match: "talk through", "sanity check", "pre-design", "thinking about" combined with concerns about data, auth, compliance, or PII

## Routing
- User already has a clear design direction and just wants to produce variants → `grimoire-design`
- A full design with artifacts (problem.md, variants, scenarios) already exists and the user wants critical feedback → `grimoire-review`
- User describes a bug rather than a new design → `grimoire-bug` or `grimoire-bug-report`
- Change is purely behavioral / non-UI and the user is ready to spec it → `grimoire-draft`

## Prerequisites
- A `change-id` (existing or new). If no change exists yet, create the directory `.grimoire/changes/<change-id>/` with just a placeholder so `consult.md` has a home — no manifest, features, decisions, or tasks needed.
- `.grimoire/config.yaml` exists (for surface, compliance, brand context). If absent, the consult still runs but skips the briefing axes that would require it.

## Skipping
This skill is optional. Engineers and designers can skip straight to `grimoire-draft` or `grimoire-design`. When the user skips and the change touches PII / payments / auth / compliance tags, downstream skills emit a one-line soft suggestion ("Consider `grimoire-design-consult` first — this change touches PII") but do not block.

## Modes

These are **conversational invocations** the AI interprets, not commander.js subcommands of the `grimoire` binary. Per ADR-0010, skills are pure markdown — the AI decides how to behave based on what the user said.

- `--personas=security,data,qa` or "add QA persona" / "include the product manager" — adds personas beyond the default Security + Data pair. Allowed names match `../references/review-personas.md` §4 (product, senior, security, qa, data, adversarial-user). Do not load Code Style Reviewer or Contrarian — they are diff-time personas.
- "shorter consult" / "quick consult" — cap each persona at 3 questions instead of the usual 5-8
- "skip security" / "skip data" — drop a default persona for a single run (rare; warn the user once if their problem statement mentions PII / payments / auth and they skip security)

## Workflow

### 1. Collect Minimal Input
Ask the user for these in one focused prompt — do not interrogate:

| Input | Required | Notes |
|---|---|---|
| Problem statement | yes | One paragraph: what user pain or business need this addresses |
| Proposed user flow | optional | 1-2 sentences. Skip-with-Enter accepted |
| Data the design will touch | optional | Free text: "user profiles", "payment methods", "none" all valid |

If the user provides only a problem statement, proceed — do not gate on the optional inputs. The personas will ask about the missing pieces themselves; that is the point.

Resolve or create `change-id`. If the user hasn't named one, propose a slug from the problem statement and confirm.

### 2. Build the Mini-Briefing
Follow the briefing pattern in `../references/review-personas.md` §1, but **pared down** for pre-design context. Skip the feature inventory (the change has no features yet) and focus on the axes that matter for security / data Q&A:

**Sources** (subset of review-personas.md §1):
- `.grimoire/config.yaml` → `project.surface`, `project.compliance`, `project.language`
- `.grimoire/docs/context.yml` if present → deployment environment, related services, trust boundaries
- All `.grimoire/decisions/*.md` with `status: accepted` — extract ID, title, top driver
- Tag histogram across `.grimoire/changes/**/*.feature` for data-sensitivity signals (pii, payment, auth, phi)
- `.grimoire/brand/tokens.json` existence (one bit — not needed for security/data questions but informs surface context)

**Briefing block** (inject as preface to every persona, mirror review-personas.md §1 format):

```markdown
## Project Briefing (consult)

**Surface:** <tui | web | mobile | api | mixed | unknown>
**Stage:** <prototype | internal | customer-facing | regulated — from compliance + README>
**Data sensitivity:** <none | pii | financial | phi — from tag histogram + compliance>
**Compliance:** <list configured frameworks, or "none">
**Threat surface signals:** <tags with count >0 — auth=N, pii=N, payment=N>
**Active constraints (accepted ADRs):**
- ADR-XXXX — <title>
- ...
```

Skip the Feature Inventory and Linked-change Non-goals sections — there are no features yet and the consult precedes the manifest.

### 3. Engage Personas in Q&A Mode
**This is the core difference from `grimoire-review`.** Personas ASK questions; the designer ANSWERS. No blocker/suggestion grading. No materiality gate (the gate exists to keep reviewers from manufacturing findings — Q&A doesn't have findings).

Default personas: **Security Engineer** + **Data Engineer**. Add others only when the user invokes a mode flag (e.g., `--personas=security,data,qa`).

For each engaged persona:
- Read the persona's section in `../references/review-personas.md` §4 to understand its concerns (what it cares about, what it would flag in a review).
- Translate those concerns into clarifying questions for the designer, using the interview patterns in `../references/elicitation-personas.md` for that persona.
- Ask 5-8 questions per persona by default (3 in "quick consult" mode). One at a time or batched 3-5 per turn — match the user's pace.
- Questions are conversational. Examples:
  - Security: "What user data flows through this screen?", "Does any of it leave the boundary of our service?", "Is this surface authenticated, or public?", "Are there compliance frameworks (GDPR, HIPAA) that apply to this data?"
  - Data: "What entities does this design touch?", "Are you reading from existing tables or creating new ones?", "If new fields are needed, what's the cardinality and nullability?", "Are there migrations implied?"
- Do **not** dump a checklist. Skip questions whose answers are already obvious from the problem statement or briefing.
- Do **not** produce blocker/suggestion findings. If a persona spots a real risk, frame it as a question ("Have you considered what happens if X?") not a verdict ("[blocker] X is wrong").

Record the transcript verbatim for `consult.md` — questions asked, designer's answers, follow-up questions.

### 4. Distill Assumptions, Givens, and Open Questions
Once each persona has finished its Q&A pass, summarize the transcript into three distinct lists:

- **Inferred assumptions** — things the design must hold true to be valid. Examples: "All write operations happen behind authentication." / "PII is only displayed to the owning user, never logged." Phrase as positive declarations the design will need to honor.
- **Inferred givens** — constraints from existing systems, compliance, or accepted ADRs that the design cannot change. Examples: "User auth flows through the existing `auth-service` (ADR-0007)." / "PII storage must encrypt at rest per project.compliance: gdpr."
- **Open questions** — items the designer could not answer in this consult. These are flags for follow-up, not blockers. Examples: "Unknown: retention window for payment audit logs — needs product input." / "Unknown: whether mobile clients will consume this surface in phase 1."

Be honest about the boundary between assumption and given: a *given* is something the world imposes (compliance, an ADR, an existing service contract); an *assumption* is something the designer commits to upholding.

### 5. Write `.grimoire/changes/<id>/consult.md`
Compose the file with explicit, implementable sections in this order:

```markdown
# Pre-design consult: <change-id>

## Problem statement
<user's problem statement, verbatim>

## Proposed user flow
<user's input, or "Not provided">

## Data the design will touch
<user's input, or "Not provided">

## Project Briefing (consult)
<briefing block from step 2>

## Security Q&A
**Q:** <question 1>
**A:** <designer's answer>

**Q:** <question 2>
**A:** <designer's answer>
...

## Data Q&A
**Q:** <question 1>
**A:** <designer's answer>
...

## <Any other engaged personas> Q&A
<same Q/A format>

## Inferred assumptions
- <assumption 1>
- <assumption 2>
...

## Inferred givens
- <given 1, with ADR / compliance citation where applicable>
- <given 2>
...

## Open questions
- <unanswered item 1 — flagged for follow-up>
- <unanswered item 2>
...

## Personas engaged
- Security Engineer
- Data Engineer
<- ... other personas if added via mode flag>
```

Do not invent content for empty sections. If the designer skipped "Proposed user flow", write "Not provided" — do not synthesize one. If a Q&A turn produced no actionable assumption, the assumptions list can be short.

### 6. Handoff
Tell the user what runs next and what those skills will do with `consult.md`:

- **`grimoire-design`** on the same `change-id` will read `consult.md` first, propagate assumptions and givens into prompts for variant generation (e.g., "exclude patterns that violate givens"), and copy the lists into `manifest.md` when the designer accepts a direction.
- **`grimoire-draft`** on the same `change-id` will read `consult.md` and copy "Inferred assumptions" + "Inferred givens" into `manifest.md` (Assumptions section, plus a new Givens section) at level 3-4 complexity.
- **Open questions** travel into `manifest.md` as unvalidated assumptions for the designer/PM to resolve before plan.

Do not invoke the next skill automatically. Confirm with the user, then suggest the next command.

## Important
- **This is Q&A, not findings.** Personas ASK questions of the designer; they do not produce blocker/suggestion verdicts. If you catch yourself writing `[blocker]` or `[suggestion]` in `consult.md`, stop — that is `grimoire-review`'s job, not this skill's.
- **No materiality gate.** The review-personas materiality gate exists to prevent manufactured findings. Q&A doesn't produce findings, so the gate does not apply — but the *intent* still holds: ask questions whose answers will change the design, not questions whose answers are already obvious from the briefing.
- **Minimal input bar.** Problem statement only is enough to start. Do not interrogate the user before engaging personas — the personas exist to ask the missing questions.
- **Available to engineers too.** This skill is not designer-exclusive. An engineer who says "I'm thinking about adding X, what should I worry about?" is invoking the same workflow. The output flows into `grimoire-draft` the same way it flows into `grimoire-design`.
- **Do not load Contrarian or Code Style personas.** Contrarian challenges other personas' findings; Code Style reviews diffs. Neither has a role in pre-design Q&A.
- **Honor the briefing pare-down.** Do not include the full review-personas.md §1 briefing — skip Feature Inventory and Linked-change Non-goals. They add noise without informing the questions a consult needs to ask.
- **Pure markdown skill.** Do not generate executable code. The `--personas=` and "quick consult" mode markers in this file describe how the AI interprets user phrasing — they are not CLI flags of the `grimoire` binary.

## Done
When `consult.md` is written and the user has acknowledged the handoff path, the consult is complete. Suggest `grimoire-design` (visual surface work) or `grimoire-draft` (behavioral specs) as the next step on the same `change-id`.
