---
name: grimoire-draft
description: Design a change collaboratively on one living draft.md. grimoire-plan then projects it into Gherkin features, constraints, and MADR decisions. Use when the user describes new functionality, requirements, or architecture choices.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.2"
---

# grimoire-draft

Design a change on **one living document** (`draft.md`), iterating with the user until the
design is agreed. `grimoire-plan` then **projects** that design into its durable homes
(features, constraints, decisions) — draft itself does not write them.

The core idea: spread-out artifacts hinder the thinking. So you do all the designing in a
single coherent doc — diagram/sketch, a decision ledger, pseudo-code, an open-question
ledger — and it is fragmented into separate homes (by plan) only **after agreement**. `draft.md` is
ephemeral: retained as reference through the pipeline, deleted when `grimoire-apply` clears
the change folder. Git history preserves it.

## Triggers
- User describes new functionality, behavior changes, or feature requests
- User asks to create/update a feature spec or requirement
- User describes a technology choice, architecture decision, or trade-off
- Loose match: contains "feature", "requirement", "spec", "decision", "grimoire" with "create", "draft", "plan", "start", "new"

## Routing (coarse — up front)

Decide only whether to design at all, and in which skill. The **fine** routing (which fact
becomes a feature vs. a constraint vs. a decision) happens later, at projection — now `grimoire-plan`'s first step.

- Bug report ("something is broken") → `grimoire-bug` or `grimoire-bug-report`
- Pure refactoring (no behavior change) → no grimoire artifact needed. Suggest an ADR only if architecturally significant.
- Config, deps, formatting → not grimoire territory. Just do it.
- Otherwise → design it here. If genuinely unclear whether this is a grimoire change, ask one clarifying question rather than guessing.

## Workflow

### 1. Qualify the Request — Jurisdiction (coarse)

Confirm this is a change worth designing, and which skill owns it (table above). You do
**not** need to assign each fact to a home yet — during design everything lives in one
`draft.md`; per-fact routing is a projection concern, handled in `grimoire-plan`.

The one up-front question that matters: **is this a behavior/feature/architecture change**
(→ design it here), or a bug / pure refactor / config tweak (→ route away, per the table)?
If unclear, ask one question. Do not default to "draft a feature".

### 2. Triviality Gate

Complexity is an **output** of design, not an input — you cannot score it honestly before
the design exists. Up front, make only one binary call:

- **Trivial** — config, typo, copy change, single-file fix, dependency bump. Skip the
  `draft.md` loop: make the change directly, record a minimal `manifest.md` (Why + file
  list), done.
- **Non-trivial** — anything else. Build a `draft.md` and design the change (steps 3–7).

The full **complexity level (1–4)** is scored at **projection** (`grimoire-plan`'s first step), once the design
is settled, and written to `manifest.md` — not before (a premature number biases the design
to fit it). During design, use the table below only as a rough guide for how deep to
research and elicit; depth grows with the change, it is not pre-allocated.

| Level | Label | Signals | Drives (recorded at projection) |
|-------|-------|---------|---------------------------------|
| 1 | Trivial | Config, typo, copy, single-file fix | handled by the gate above — no `draft.md` |
| 2 | Simple | Single capability, ≤3 files, no architecture/data changes | Plan: coarser tasks · Review: Senior Engineer only |
| 3 | Moderate | Multiple capabilities, architecture decisions, data/dep changes | Plan: fine-grained · Review: all relevant personas · manifest carries Assumptions + Pre-Mortem |
| 4 | Complex | Cross-cutting, multiple services, security-sensitive, new infra | Plan: fine-grained · Review: all personas mandatory (`grimoire-review` not optional) · Assumptions + Pre-Mortem |

If unsure between two levels at projection, pick the higher. The user can override ("treat this as complex").

### 3. Research Existing Solutions

Before designing, research what already exists. Do not ask the user to research — do it yourself.

- Trivial changes never reach this step (handled by the gate).
- Otherwise research **proportional to scope**: a single first-party capability needs only a
  built-ins / first-party check; architecture decisions, new dependencies, or cross-cutting
  concerns need full research across all categories.

Follow the methodology in `../references/build-vs-buy.md`. Read candidates at **interface altitude** — public API, types, and docs, not their source or tests (`../references/artifact-map.md` → Reading altitude). The findings feed the `draft.md`
**Why** (and, for an adopt/build/hybrid call, the manifest **Prior Art** at projection).
Present findings to the user and get agreement on direction before designing deeply.

### 4. Design Input Check

Check whether design artifacts already exist for this change, so the design is grounded in
real components and states rather than imagined ones. Consumed output anchors the `draft.md`
**At a glance** section.

- **Existing design output**: If `.grimoire/changes/<change-id>/designs/` is already populated (a prior `grimoire-design` run produced `problem.md`, `variants.md`, `variant-{n}.html`, or `figma-snapshot.json`), read those now. Treat them as authoritative for component shape, states, and visual tokens — do not re-query Figma. The visual + component/state material becomes the **At a glance** anchor and seeds the behavioral **Sketches**.
- **Figma MCP available, no design folder**: If `project.design_tool.mcp` is configured and `designs/` is absent, ask: "Figma file URL or node ID? (or skip)". On a URL or node reference, query the Figma MCP for frame data and cache the response at `.grimoire/changes/<change-id>/designs/figma-snapshot.json` per `../references/design-input-formats.md` §1 Cache. On "skip" or empty input, continue.
- **No MCP and no design folder**: skip this step silently.

### 5. Scaffold & Map Existing State

- Choose a `change-id`: kebab-case, verb-led (`add-`, `update-`, `remove-`).
- Ensure you're on a feature branch for this change (`grimoire-branch-guard` usually created it). The branch is where `draft.md` and, later, the projected artifacts are edited live.
- Create `.grimoire/changes/<change-id>/draft.md` from `templates/draft.md`, setting `kind: greenfield | refactor`.

Then map what already exists so the design isn't blind:

- Read `features/` for the current behavioral baseline, `.grimoire/decisions/` for existing decisions, `.grimoire/docs/context.yml` for the deployment environment and sibling services. Check `.grimoire/changes/` for in-progress changes that overlap — flag conflicts. See `../references/artifact-map.md` for reading discipline.
- **For `kind: refactor` — build the Current state section (required).** Map how the touched system works **today**, with `file:line` breadcrumbs, into `draft.md` → *Current state*, followed by a severity-ranked Gaps/drift list. **Mandate the codebase graph**: if the repo isn't indexed, run `index_repository` first, then use `search_graph` / `trace_path` / `get_code_snippet` for qualified names, callers, and call chains. This map is the load-bearing grounding for a refactor — you cannot redesign what you haven't located.
- If `.grimoire/changes/<change-id>/consult.md` exists (from `grimoire-design-consult`), parse `## Inferred assumptions` and `## Inferred givens` and carry them into the `draft.md` design: assumptions → *Decided/Open* (each becomes an Open row, or a Decided row if the consult resolved it); givens → context for the *Decisions* ledger. The H2 headers `## Inferred assumptions` and `## Inferred givens` are load-bearing — they are the exact section names `grimoire-design-consult` writes; do not paraphrase, retitle, or fuzzy-match. **Open questions from `consult.md` are NOT copied** — they remain in `consult.md` as designer follow-up items.

### 6. Design the Change — the loop (the interview happens HERE)

This single loop replaces what used to be separate "elicit requirements", "draft", and
"collaborate" steps. **Interviewing IS iterating on `draft.md`.** There is no gather-then-
transcribe split — requirements surface, get questioned, and resolve inside the doc.

**Walk the spine.** Pick the spine this change rides (`../references/design-spine.md`): the **technical spine** (process/constraints → data model → API/contract → UI) for behavioral/technical work, or the **UX-workflow spine** (backward from the goal, or forward from what the user knows) for a user-facing flow. Then **always walk its layers in order** — at each layer: elicit with that layer's lens, record its decisions, and validate the prior layer against what you just learned (a required field must trace to a downstream need; the data model must satisfy the process constraints). An empty layer is a one-line skip, not a silent omission. Ceremony scales to constraints: lightweight by default, but once the change introduces **more than 2 constraints**, walk every layer formally — that 3rd constraint is complexity surfacing.

Iterate with the user, directly on `draft.md`:

```
loop:
  propose   → decisions into the Decisions ledger as Y-statements (../references/design-spine.md); shapes into Sketches; a diagram/sketch into At a glance
  question  → unknowns become rows under Open (use ../references/elicitation-personas.md as lenses)
  user reacts → answers / edits the doc
  resolve   → strike the Open row IN PLACE: `RESOLVED: <answer> (Dn)` — never delete it
until Decided is stable AND Open is empty-or-deferred.
```

**Explore before you converge.** When the design approach is genuinely open — more than one
reasonable shape exists — sketch **2–3 candidate approaches** at a high level (one or two
lines each: the idea + its main trade-off) and let the user pick a direction *before* you
deep-dive the ledger on one. Don't silently commit to the first idea that works; the first
idea is rarely the best, and an unexamined commitment is the *Silently filling a gap* red
flag at design scale (`../references/red-flags.md`). Keep this lightweight: it is a quick
approach-level fork, not a variants matrix — **visual/UI variants are `grimoire-design`'s
job**. When the approach is obvious or forced (one viable shape), say so in one line and
proceed; don't manufacture alternatives.

Discipline for the loop:

1. **Outcome & Non-goals first.** Pin these (into *Why*) before anything else — they set scope. Restate them back to the user.
2. **Batch questions, then wait.** Ask 3–5 at a time, grouped by concern, as Open rows. Stop. Wait. Do not propose decisions past an unanswered batch.
3. **Ask the question; don't pre-answer it.** "Should locked accounts get an email?" — not "I'll assume locked accounts get an email." The pre-answered form lets the user nod through assumptions they'd otherwise correct.
4. **One question per real ambiguity, not a checklist dump.** Ask the few that matter for *this* change.
5. **Disambiguate immediately.** If an answer is vague ("handle errors gracefully"), ask the specific follow-up and record the concrete answer. Never leave a vague answer in the ledger.
6. **Capture, don't extrapolate.** "Out of scope for now" → record as a non-goal and stop. Don't design a scenario "just in case".
7. **When the user delegates** ("just write something reasonable"), record it explicitly as an Open→RESOLVED row: "Defaulting to <choice> per user delegation — flag in review if wrong." The assumption stays visible.
8. **Sort facts by kind as they emerge.** An invariant (security control, NFR, performance budget, observability guarantee) is not a behavior — capture it in the *Constraints* section, not as a behavioral sketch. Apply the rough behaviour-vs-invariant test as you design (does an external actor observe it without reading code/logs?) so projection's admission test (in `grimoire-plan`) gets clean input instead of slop to reroute. The fine fact-to-home routing still happens at projection; this just keeps the design honest while you think.

**Never silently fill an open question.** Either ask it (as an *Open* row), defer it to a non-goal, or record the inference explicitly in *Decided*. The *Decided/Open* ledger IS the requirements summary — before declaring the design done, walk it back to the user so they see every call and every guess.

**Nothing is written to `features/`, `.grimoire/docs/constraints.md`, or `.grimoire/decisions/` during this loop.** Everything lives in `draft.md`. The design is "done" when *Decided* is stable and *Open* is empty-or-deferred — and the user agrees.

Do NOT hand off to `grimoire-plan` without explicit user approval of the design.

### 7. Hand off — projection happens in plan

Draft ends when the design on `draft.md` is agreed. **Projection — turning the design into its
durable homes (features, constraints, MADRs, `data.yml`, manifest) — is now the first step of
`grimoire-plan`**, co-located with the planning that consumes those homes. A two-phase draft
(design *then* project) was one job too many; draft now does one thing — design the change —
and hands the agreed `draft.md` to plan.

So draft does **not** write `features/`, `.grimoire/docs/constraints.md`,
`.grimoire/decisions/`, `data.yml`, or the full `manifest.md`. What it leaves for plan:

- `draft.md` — the agreed design: the Decisions ledger (Y-statements), Decided/Open, Sketches,
  Constraints, and Cut sections. This is the single source plan projects from.
- The change folder and the feature branch.

**Exception — trivial changes** (the step-2 triviality gate) skip plan entirely: draft makes
the change directly and records the minimal `manifest.md` (Why + file list) itself.

## Important
- ONE change at a time. Don't combine unrelated changes.
- **Catch the rationalizations.** "Too small to spec", "I'll just assume a reasonable default" are the named excuses in `../references/red-flags.md` (*Skipping the spec*, *Silently filling a gap*). The urge to skip is the signal to do the step — not skip it.
- **`draft.md` is the only surface you design on.** Features, constraints, MADRs, and the manifest are **generated from it** at projection (`grimoire-plan`'s first step) — never authored by hand in parallel during design, and not written by draft at all.
- **Features describe actor-observable behavior, not implementation, and not invariants.** No external actor, not observable, or names a library/log-level/table → it's a constraint (→ `constraints.md`) or a decision (→ MADR). An internal protocol or service-to-service contract (your own components talking) is a contract test, not a `.feature` — "external" means outside your system, not outside one module. These two — invariants and internal protocols — are the top sources of feature-file slop.
- **One fact, one home** (`../references/principles.md`). A capability lives in one `.feature`; a control in one constraint row; a decision in one MADR. Never the same fact in two homes (at rest).
- Decisions live in **one inline ledger** in `draft.md` while designing (Y-statements); they project to separate MADRs only at projection, in `grimoire-plan`. This is how coupled decisions stay legible during the thinking.
- Projected artifacts are edited **live on the branch** — never copied into `.grimoire/changes/`. `git diff` is the staging area.
- **Figma access token is read from `FIGMA_ACCESS_TOKEN` by the MCP server.** Never log it, never write it to config or any artifact (`manifest.md`, `consult.md`, `figma-snapshot.json`, `draft.md`). The MCP handles auth transparently.

## Done
When the user approves the design on `draft.md`, the workflow is complete — draft does not
project. Present the change directory path and suggest next steps:
- `grimoire-plan` — projects the design into features/constraints/MADRs/manifest, then generates tasks
- Or further iteration on `draft.md` if the user wants changes
