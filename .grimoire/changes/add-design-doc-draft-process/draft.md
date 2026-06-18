---
status: draft
change-id: add-design-doc-draft-process
kind: refactor
---

# Living design-doc draft process — design

**Date:** 2026-06-17 · **Provenance:** distilled from two hand-authored design docs
Fred prefers over the current `grimoire-draft` flow — `heimdall/notes/project-skeleton.md`
(greenfield, trim-and-cut) and `kiwi-dev/notes/doc-types-usage-map.md` (refactor,
current-state-map + decision-ledger). Aligns with [[project_grimoire_redesign]]
(OVERVIEW, live-edit on branch, graph-as-structure).

> **This file is itself the artifact under design.** It is written in the very
> format it proposes — one living doc, inline decision ledger, breadcrumbs,
> pseudo-code sketch, decided/open ledger. Read it as the worked example.

---

## At a glance

The change inserts ONE collaborative surface — `draft.md` — between routing and
fragmentation. Today `grimoire-draft` fragments thinking into separate homes
*immediately*. The new flow lets the design converge in one doc, then projects to
the homes only at finalize.

```
                        TODAY (grimoire-draft)
  request → jurisdiction → complexity → research → interview
         → [step 7: write straight into features/ + constraints.md + MADR files]   ← fragments NOW
         → manifest.md (lightweight glue)

                        PROPOSED
  request → jurisdiction → complexity → research → interview
         → BUILD draft.md  ───────────────┐   one living doc, edited with the user
              ├─ At a glance (diagram | sketch)        ← graspable in one screen
              ├─ Why  (greenfield: objective+non-goals │ refactor: pain points + breadcrumbs)
              ├─ Current state  (REFACTOR ONLY: how-it-works-today + breadcrumbs + gaps)
              ├─ Decisions  (ONE inline ledger: D1..DN, sub-IDs, cross-refs, each + why)
              ├─ Sketches  (pseudo-code / key considerations — "not final")
              ├─ Constraints (invariants)
              ├─ Decided / Open  (open resolves in place: RESOLVED: …)
              └─ Cut / deferred  (greenfield-leaning: cut · why · re-add-when)
         → interview/iterate ON draft.md   ← ONE loop = today's elicit+draft+collaborate (D9)
         → on AGREEMENT, draft PROJECTS draft.md into the homes (D-PROJ-2):
              Decisions  → MADRs (.grimoire/decisions/NNNN-*.md)   [D-PROJ-1]
              Constraints→ .grimoire/docs/constraints.md
              Behaviors  → features/*.feature  (admission test still gates)
              + manifest.md (generated — grimoire-plan input)      [D-PROJ-3]
         → draft.md RETAINED read-only as reference through plan → … → apply
         → grimoire-apply CLOSING STEP: delete draft.md            (D2)
```

One-fact-one-home is preserved **at rest** — projection (in draft, on agreement) is the
gate. The straightjacket is lifted only during thinking; draft.md lingers as reference
until apply, then is deleted.

---

## Why

**The root problem (Fred's words):** the spread-out artifacts and their structure
*hinder the design/drafting process itself* — it is hard to see what is happening
when the change is scattered across features + constraints + N MADR files + a manifest
the moment you start. Review and iteration were so hard that Fred resorted to
hand-writing a single detailed prompt containing everything the drafting process
needed — i.e. manually reconstructing the one coherent surface the tool fails to give.
`draft.md` IS that surface, made first-class: **one ephemeral doc you design in; every
other artifact is generated FROM it only after agreement.** The fragmentation is moved
to *after* the thinking, never during.

The current `grimoire-draft` is a strong **router + interviewer + formalizer** but a
weak **thinking surface**. Concrete pain points (each a located smell):

- **Immediate fragmentation.** `grimoire-draft/SKILL.md` step 7 ("Draft Artifacts")
  writes straight into `features/`, `.grimoire/docs/constraints.md`, and separate
  `.grimoire/decisions/NNNN-*.md` files. There is no surface where the whole change
  lives as one coherent picture before it is shattered across homes. Fred's two
  preferred docs both keep everything in ONE file until it is settled.
- **Decisions scattered into N files from the start.** SKILL.md step 7
  ("For architecture decisions") mints one sequential MADR per decision *during*
  drafting. Both reference docs instead keep a single **inline decision ledger**
  (`D1..D15` in kiwi-dev; a "Decided" list in heimdall) with sub-IDs and
  cross-references (kiwi `D11` cites `D7`). Cross-referencing tightly-coupled
  decisions across separate files is high-friction; a ledger is how Fred actually
  reasons.
- **No current-state map for refactors.** SKILL.md step 5 ("Check Existing State")
  only *reads* `features/` + `decisions/` to avoid conflicts. It never produces a
  **map of how the touched system works today, with `file:line` breadcrumbs** — the
  load-bearing first half of the kiwi-dev refactor doc. Refactors are designed blind.
- **No first-class place for pseudo-code / key considerations.** The manifest
  (`templates/manifest.md`) is "lightweight glue" — Why, Non-goals, file lists. There
  is nowhere to sketch the target shape in pseudo-code, the thing Fred called out as
  important for non-process design.
- **Open questions have no living home.** SKILL.md step 4 ("Open-question
  discipline") pushes open questions into manifest *Assumptions*. There is no ledger
  where an open question is later struck **in place** with its resolution
  (kiwi-dev's `RESOLVED:` lines) — the audit trail of the thinking is lost.

The manifest isn't wrong; it's the wrong *granularity*. It captures the destination,
not the journey. `draft.md` is the journey; the manifest/homes remain the record.

---

## Current state (what grimoire-draft does today)

Breadcrumbs to the live skill so the projection step can be wired precisely.

| Step | `grimoire-draft/SKILL.md` | What it does | Fate under this change |
|------|---------------------------|--------------|------------------------|
| 1 | "Qualify the Request — Jurisdiction" | routing table + 4-gate admission test | **keep** — runs before draft.md |
| 2 | "Score Complexity" | level 1–4 → ceremony, scored up front | **split** → a cheap *triviality* check up front gates draft.md; the full 1–4 score moves to **finalize** and lands in the manifest (D5) |
| 3 | "Research Existing Solutions" | build-vs-buy | **keep** — feeds draft.md *Why/Prior Art* |
| 4.0 | "Design Input Check" | Figma/`grimoire-design` ingest | **keep** — feeds *At a glance* |
| 4 | "Elicit Requirements" | interview, personas | **MERGE into the loop (D9)** — interviewing is not a pre-phase; it happens *on* draft.md. Personas become lenses for proposing/challenging ledger entries. |
| 5 | "Check Existing State" | reads features/decisions to avoid conflict | **extend** → add *map current state w/ breadcrumbs* sub-step for refactors |
| 6 | "Scaffold the Change" | `change-id`, branch, `changes/<id>/` | **keep** — draft.md lands here |
| **7** | **"Draft Artifacts"** | **writes live into features/constraints/MADR + manifest** | **split**: drafting is the design-iteration loop on draft.md; writing-into-homes moves to finalize projection |
| 8 | "Collaborate" | iterate w/ user | **MERGE into the loop (D9)** — same loop as 4 + 7; not a distinct step |
| 9 | "Validate" | gherkin/MADR/manifest + admission re-test + principles gate | **keep** — runs at projection time |

Supporting surfaces touched:

- `templates/manifest.md` — lightweight glue; **stays** but is no longer where
  thinking happens. Possibly slimmed (Why/Non-goals may move to draft.md *Why*).
- `skills/references/artifact-map.md` — what each artifact is; **add** a `draft.md`
  row (ephemeral, scratch, deleted at finalize).
- `skills/references/principles.md` — one-fact-one-home / DRY / KISS; **unchanged**,
  but now enforced at the *projection* gate, not at thinking time.
- `skills/grimoire-apply` — finalize skill; flips MADR `proposed → accepted`,
  deletes `changes/<id>/`. **Extend** to run (or assert) the projection + delete
  `draft.md`.
- `skills/grimoire-plan` — consumes `manifest.md`. Must still find what it needs after
  projection (manifest remains its input; draft.md is gone by then).
- `.grimoire/decisions/` — sequential MADRs, next free number **0034**. The ledger
  projects here.

### Gaps / drift this introduces (severity = adoption risk)

1. **MEDIUM — DRY temporarily violated mid-flight.** While `draft.md` exists, facts
   live both in the ledger/sketches AND (potentially) partially in homes. Mitigated by
   [D2]: nothing is written to a home until projection; during thinking the homes are
   untouched. The duplication window is *draft.md vs. nothing*, not *draft.md vs.
   homes*.
2. **MEDIUM — two ways to draft, if both old + new paths remain.** Violates
   "one right way" ([[feedback_dry_one_way]]). Mitigated by [D5]: draft.md is not an
   optional parallel path — it *replaces* step 7 drafting for level ≥ 2. Level 1 keeps
   the lightweight direct path (no draft.md).
3. **LOW — `grimoire-plan` input continuity.** Plan reads the manifest, not draft.md.
   As long as projection writes the manifest before draft.md is deleted, plan is
   unaffected.

---

## Decisions

One inline ledger. `D-PROJ-*` = projection/finalize decisions. Each row: decision + why.
These **project to MADRs** at finalize per the user's choice (ledger → MADR files).

| # | Decision | Why |
|---|----------|-----|
| D1 | **Add `draft.md` as the single collaborative drafting surface**, at `.grimoire/changes/<id>/draft.md`. | Matches the two docs Fred prefers; one place to think before fragmenting. |
| D2 | **draft.md is EPHEMERAL but lives until APPLY completes** — NOT deleted at draft finalize. The real artifacts are generated in *draft* (after agreement); draft.md is then **retained read-only as the agreed reference** through the downstream skills (plan → … → apply). `grimoire-apply`'s only added job is to **delete draft.md as its closing step**. Homes (features/constraints/MADR/manifest) stay authoritative at rest. | User: "keep the design for reference during apply; once apply is done it can be deleted." Projection happens in draft (D-PROJ-2); draft.md outlives draft purely as reference, never entering the durable record. |
| D2a | **draft.md is the SOLE design surface; ALL other artifacts (features, constraints, MADRs, AND the manifest) are GENERATED from it, only after agreement.** Nothing else is authored by hand during design. | User: "use the design to create the other artifacts after we have agreement." The fragmentation that hindered iteration is pushed to *after* the thinking. No artifact is hand-maintained in parallel with draft.md (no DRY violation, because the homes don't exist yet during design). |
| D3 | **One template, flexes by `kind` (greenfield \| refactor).** Greenfield skips *Current state*, leans on *Cut/deferred*; refactor requires *Current state* + breadcrumbs, thins *Cut*. | Both reference docs share a backbone but differ on grounding (research-appendix vs. current-state-map). One template, two emphases — don't fork into two templates (KISS). |
| D4 | **Decisions live in ONE inline ledger** in draft.md (D1..DN, sub-IDs, cross-refs) during thinking. | How Fred reasons; cross-referencing coupled decisions across separate files is high-friction. |
| D4a | **`At a glance` is diagram OR pseudo-code sketch** — whichever makes the change graspable in one screen. | heimdall used an ASCII pipeline; kiwi used class sketches. Same goal (one-screen graspability), different medium per change. |
| D5 | **Complexity is an OUTPUT of design, not a gate on it.** Up front, only a cheap **binary triviality check** runs (typo/config/copy/one-file-fix → skip draft.md, take today's direct path). For everything else, build draft.md; its depth grows organically as it is filled — sections are not pre-allocated by a score. The full 1–4 complexity level is **assessed at finalize**, once the design is settled, and written to the **manifest** (not to draft.md). | You cannot score complexity honestly before the design exists — that is what the design reveals. Pre-scoring biases the design to fit the number. Keeps the cheap "don't ceremonialize a typo" escape ([[feedback_style]] — skippable steps) without forcing a premature 1–4 judgment. Downstream skills (plan/review) still read the level off the manifest as today. |
| D6 | **Refactors get a `Current state` map step** — extend SKILL.md step 5 to produce how-it-works-today + `file:line` breadcrumbs + severity-ranked gaps, before the decision ledger. **Mandate codebase-memory-mcp: `index_repository` first if not indexed**, then `search_graph`/`trace_path`/`get_code_snippet` for the breadcrumbs. | The load-bearing half of the kiwi-dev refactor doc; you cannot design a refactor blind. User chose to mandate the graph over Grep-fallback — structural breadcrumbs (callers, call chains, qualified names) are richer and more accurate than text search, and the session already pushes mcp-first. |
| D7 | **`Sketches` section is first-class** — pseudo-code / key considerations, explicitly "not final", annotated with decision IDs. | Fred's stated requirement; the manifest had nowhere for this. |
| D8 | **`Decided / Open` ledger; open questions resolve IN PLACE** (`RESOLVED: …`), not deleted. | Preserves the audit trail of the thinking (kiwi-dev pattern). Replaces pushing open questions only into manifest Assumptions. |
| D-PROJ-1 | **At finalize, the ledger PROJECTS to MADRs** — each *novel* decision (novelty gate from SKILL.md step 7 still applies) becomes a sequential `.grimoire/decisions/NNNN-*.md`; obvious tooling picks fold into the baseline ADR (`0033`). | User's pick (project ledger → MADR files). Keeps grimoire's existing MADR model at rest; draft.md ledger is scratch only. |
| D-PROJ-2 | **`grimoire-draft` owns projection, at the end of the design loop (after agreement).** Once *Decided* is stable and *Open* is empty-or-deferred, draft generates the homes from draft.md — decisions→MADRs, constraints→constraints.md, behaviors→features/, plus the manifest — running the admission test + principles gate (SKILL.md step 9) as it writes. `grimoire-apply` does NOT generate artifacts; its only added responsibility is to **delete draft.md** as its closing step. | User: "grimoire-apply doesn't create features/constraints/MADRs — that still happens in draft; the closing step just deletes draft.md." Keeps today's pipeline intact (plan/implement/apply read the real homes); draft.md is retained only as reference. |
| D-PROJ-3 | **The manifest is itself a GENERATED artifact** (produced at draft projection from draft.md), not a hand-authored parallel doc. It remains `grimoire-plan`'s input shape. | D2a — everything is generated from draft.md. Manifest stops being a thing you fill during design; it falls out of projection. |
| D10 | **Minimal shape for small (non-trivial) changes** = *At a glance* + *Why* + *Decisions* + *Decided/Open*. *Current state* (refactor-only), *Sketches*, *Constraints*, *Cut* are included only when they carry weight. | Avoids forcing empty sections on a small change while keeping the spine (graspability + why + decision ledger + open tracking). Sections earn their place; the template documents which are required vs. as-needed. |
| D11 | **`grimoire-design` (Figma/UI) output feeds *At a glance* and seeds *Sketches*.** SKILL.md step 4.0 already ingests Figma/`grimoire-design`; that visual + component/state material becomes the *At a glance* anchor for UI changes, and accepted scenarios seed the behavioral sketches. | Don't re-query or duplicate design input — reuse what step 4.0 cached. UI design and change-design are different layers; the UI design is an *input* to the change design. |
| D12 | **"Deleted" ≠ lost.** draft.md is git-tracked on the change branch while live, so after `grimoire-apply` deletes it the full design + rationale remains recoverable from git history. | Aligns with [[feedback_dont_reinvent]] — git is the history mechanism; the ephemeral doc's journey is never truly destroyed, removing the "we threw away the reasoning" objection to ephemerality. |
| D14 | **The change-design file is named `draft.md`** (at `.grimoire/changes/<id>/draft.md`), NOT `draft.md`. | User's pick. Avoids collision with the existing UI-design surface (`grimoire-design`, `grimoire-design-consult`, the `changes/<id>/designs/` folder). Matches the `grimoire-draft` skill name — it is the doc you draft. |
| D15 | **`grimoire-review` reviews the PROJECTED HOMES, not draft.md** — unchanged from today. | User's pick. Keeps review pointed at the durable artifacts (features/constraints/MADRs); draft.md stays a thinking/reference surface, not a review target. Avoids reviewing a doc slated for deletion. |
| D13 | **Routing is split: COARSE up front, FINE at projection.** Step 1 keeps the up-front coarse routing (is this a grimoire change at all? bug → `grimoire-bug`; pure refactor → no artifact; config → none). The FINE fact-to-home routing (this assertion → constraint vs. this behavior → feature vs. this trade-off → MADR) moves to **projection** (D-PROJ-2), where the admission test + jurisdiction table decide each home. | During design you think in one doc, not in homes — so per-fact home assignment can't happen up front. But you still must decide up front whether to design at all. Coarse gate stays; fine gate moves to where the facts are actually settled. |
| **D9** | **The interview IS iterating on draft.md — not a separate up-front phase.** There is no "elicit requirements → then draft" split. The loop is: propose decisions/sketches into the ledger → user reacts and edits → unresolved questions live in *Open* → resolve in place (`RESOLVED:`) → repeat until *Decided* stabilizes and *Open* is empty-or-deferred. This **collapses today's step 4 (Elicit) + step 7 (Draft) + step 8 (Collaborate) into ONE design-iteration loop on draft.md.** | This is the **one right way to design** ([[feedback_dry_one_way]]). Both reference docs were produced this way — by conversing directly on the living doc, not by a requirements-interview that then got transcribed into artifacts. Separating "gather requirements" from "design" creates two surfaces and a lossy handoff; the design doc *is* where requirements surface, get questioned, and resolve. Questions are Open-ledger rows; answers are `RESOLVED:` edits; decisions land in the ledger as they're made. |

---

## Sketches (not final — shape, not contract)

### `templates/draft.md` skeleton

```markdown
---
status: draft
change-id: <kebab>
kind: greenfield | refactor          # selects which sections are required
                                     # NO complexity here — it is an OUTPUT of design,
                                     # scored at finalize and written to the manifest (D5)
---

# <change> — design
**Date** · **Provenance** (prior passes / branches / source docs)

## At a glance                       # (D4a) diagram OR pseudo-code sketch — one screen

## Why                               # greenfield: objective + non-goals
                                     # refactor: pain points, each w/ file:line breadcrumb

## Current state                     # (D6) REFACTOR ONLY — how it works today
                                     #   + breadcrumbs to live code + severity-ranked gaps

## Decisions                         # (D4) ONE ledger: D1..DN · sub-IDs · cross-refs · why
                                     #   projects to MADRs at finalize (D-PROJ-1)

## Sketches                          # (D7) pseudo-code / key considerations, annotated w/ D-IDs

## Constraints                       # invariants → constraints.md at finalize

## Decided / Open                    # (D8) two lists; Open resolves in place (RESOLVED: …)

## Cut / deferred                    # greenfield-leaning: cut · why · re-add-when
```

### `grimoire-draft/SKILL.md` rewrite (sketch) — ONE design loop replaces steps 4+7+8

```
### 4–8. Design the change  (the design-iteration loop on draft.md — D9)
  - Triviality check (binary): typo/config/copy/one-file-fix → skip draft.md, write the
    change directly (today's lightweight path). Otherwise build draft.md. (D5)
  - Create .grimoire/changes/<id>/draft.md from templates/draft.md, kind = greenfield|refactor.
  - kind=refactor → first MAP CURRENT STATE: how the touched code works today,
    file:line breadcrumbs (codebase-memory-mcp; Grep fallback), severity-ranked gaps. (D6)
  - THEN iterate WITH the user, directly on draft.md (this IS the interview — D9):
      loop:
        propose      → decisions into the ledger, sketches into Sketches
        question     → unknowns become Open rows (use elicitation personas as lenses)
        user reacts  → edits the doc / answers
        resolve      → strike Open in place (RESOLVED: …); decisions stabilize in Decided
      until Decided stable AND Open empty-or-deferred.
  - NOTHING is written to features/ | constraints.md | decisions/ during the loop. (D2)
  - No separate "elicit requirements" pre-phase and no separate "collaborate" post-phase —
    requirements surface, get questioned, and resolve INSIDE this loop. (D9)

### 7b. Finalize = project into homes (run at approval, before delete)        (D-PROJ-*)
  - Decisions  → MADRs (novelty gate; sequential NNNN; baseline ADR for tooling).
  - Constraints→ append to .grimoire/docs/constraints.md.
  - Behaviors  → features/*.feature  (admission test re-run on each — step 9).
  - NOW score complexity 1–4 (design is settled) → write to manifest.md.  (D5)
  - Write/refresh manifest.md (grimoire-plan input).  (D-PROJ-3)
  - Principles gate (DRY / one-way / KISS) over the projected homes.  (step 9)
  - DO NOT delete draft.md — retain it read-only as reference; grimoire-apply deletes
    it as its closing step (D2).
```

### Greenfield vs refactor — which sections fire

```
kind = greenfield        kind = refactor
  At a glance: diagram      At a glance: pseudo-code sketch
  Why: objective+non-goals  Why: pain points + breadcrumbs
  (Current state: SKIP)     Current state: REQUIRED + gaps
  Decisions ledger          Decisions ledger
  Sketches (optional)       Sketches (expected)
  Cut/deferred: leaned-on   Cut/deferred: thin/skip
```

---

## Constraints

- draft.md **never survives finalize** — if it is present after `grimoire-apply`,
  that is a bug (it leaked into the durable record). *How-verified:* finalize asserts
  `changes/<id>/` is deleted (existing behavior; extend its test).
- No fact reaches a home (`features/`, `constraints.md`, `decisions/`) except via the
  projection gate (D-PROJ-2), so the admission test + principles gate always run.
  *How-verified:* the only writers to homes in the skill are in step 7b.
- draft.md is git-tracked on the change branch while live (so iteration is diff-able),
  consistent with "the branch is the isolation; git diff is the staging area"
  ([[feedback_dont_reinvent]]).

---

## Decided / Open

**Decided:**
- draft.md = ephemeral scratch (A), deleted at finalize. [D2]
- Decisions project ledger → MADR files at finalize. [D-PROJ-1]
- One template, flexes greenfield/refactor by `kind`. [D3]
- Adopt first: Decided/Open ledger, diagram-first/narrative, pseudo-code Sketches.
  (per Fred's priority pick)
- Complexity is an OUTPUT of design — scored at finalize, written to the manifest, never
  in draft.md. Only a binary triviality check gates whether draft.md is built. [D5]
- Interviewing IS iterating on draft.md — one loop replaces today's separate Elicit (4) +
  Draft (7) + Collaborate (8). The one right way to design. [D9]

- RESOLVED: **Manifest overlap** → no overlap. draft.md is the sole design surface; the
  manifest and every other artifact are *generated* from it at projection (D2a, D-PROJ-3).
  Nothing is hand-authored in the manifest during design.
- RESOLVED: **Who runs projection** → `grimoire-draft`, at the end of the design loop after
  agreement (D-PROJ-2). `grimoire-apply` only deletes draft.md as its closing step (D2).
  Pipeline unchanged: plan/implement/apply read the real homes as today.
- RESOLVED: **Refactor breadcrumb tooling** → mandate codebase-memory-mcp, `index_repository`
  first if needed (D6).

- RESOLVED: **Minimal shape** → D10 (At a glance + Why + Decisions + Decided/Open required;
  rest as-needed).
- RESOLVED: **`grimoire-design` feeds At a glance** → D11 (yes; UI design is an input layer).
- RESOLVED: **Manifest template fate** → it survives as projection's *output target* shape;
  draft.md template is new and separate. (D-PROJ-3)

- RESOLVED: **Naming collision** → file is `draft.md`, not `draft.md` (D14).
- RESOLVED: **grimoire-review target** → the projected homes, unchanged (D15).

**Open:** none blocking. (Tune the minimal-shape required sections after one real run.)

---

## Cut / deferred

| Cut | What it was | Why cut | Re-add when |
|-----|-------------|---------|-------------|
| Durable decision ledger (option B) | A single decisions file survives finalize instead of N MADRs | User picked project→MADR (D-PROJ-1); keeps grimoire's MADR model intact, smaller blast radius | The MADR-per-decision model proves too high-friction in practice for coupled decision sets |
| draft.md for level-1 changes | Universal draft.md on every change | Ceremony on typos/config; [[feedback_style]] wants skippable steps | Never — level 1 should stay lightweight |
| Auto-generated current-state map | Tool emits the breadcrumb map unprompted | Out of scope; the map is collaborative, written with the user, not generated | A reliable codebase-memory-mcp map proves trustworthy enough to seed it |
| Two separate templates (greenfield/refactor) | Fork the skeleton | KISS — one template with a `kind` switch (D3) | The two kinds diverge so far a shared skeleton becomes confusing |
