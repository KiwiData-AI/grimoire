# Anti-Rationalization Red Flags

Under time pressure, sunk cost, or false confidence, an AI talks itself out of the
discipline it was told to follow — and does it convincingly. The rationalizations are
predictable and few. This file names them.

This is the single home for the "excuses to skip a stage." It is the sibling of the
**Anti-Loop Protocol** in `AGENTS.md`: that governs loops *inside* a stage; this governs
skipping a stage *entirely*. Skills cite the relevant section rather than restating it.

**The rule:** when you catch yourself forming one of these thoughts, that is the signal to
*do the step*, not skip it. The urge to skip is the evidence the step is needed. A stage is
skipped only by an explicit, recorded decision (a gate that says skip) — never by a silent
rationalization that it "isn't worth it this time."

---

## Skipping the spec (→ grimoire-draft)
**Catch yourself saying:** "Too small / too obvious to draft." · "I already know what to build." · "I'll spec it after I see it work."
**Why it's wrong:** "Too small" is a complexity judgment, and complexity is an *output* of design, not an input — you can't score it honestly before designing. Code-first means the spec gets reverse-engineered to match whatever you built, so it documents the bug instead of catching it.
**Instead:** Run the triviality gate (draft step 2). If it's genuinely trivial (config/typo/single-file) the gate says skip — that's a *recorded* call. Anything else: draft it.

## Silently filling a gap (→ grimoire-draft)
**Catch yourself saying:** "A reasonable default is obvious here." · "I understand enough, no need to ask." · "I'll just assume X."
**Why it's wrong:** A silent assumption the user would have corrected becomes a bug whose paper trail says "intended." One question costs seconds; a wrong guess costs a rebuild.
**Instead:** Ask it (an *Open* row), defer it to a non-goal, or record the inference explicitly as `RESOLVED: defaulting to X per delegation`. Never leave an unrecorded guess in the design.

## Skipping the plan / vague tasks (→ grimoire-plan)
**Catch yourself saying:** "Planning is overhead, I'll work it out as I go." · "The task is just 'implement the feature'."
**Why it's wrong:** A vague plan is worse than none — it gives false confidence and you re-plan mid-implementation anyway, now with code already written the wrong way. "Implement the feature" is not a task; it restates the goal.
**Instead:** Every task names exact files and one approach, small enough to execute without thinking (grimoire-plan). If a task needs thought to start, it isn't planned yet.

## Code before the test (→ grimoire-apply)
**Catch yourself saying:** "I'll add the test after." · "Let me just see it work first." · "The test is trivial, red-first is ceremony."
**Why it's wrong:** A test written after the code is shaped to pass the code, not to catch its bugs — it asserts what you built, not what was required. A test that never failed has never proven anything. This is the single most common discipline bypass.
**Instead:** Red first — watch it fail for the right reason, then make it pass (grimoire-apply). If you wrote code before the test, the honest move is to delete the code and start from red.

## Skipping review (→ grimoire-review)
**Catch yourself saying:** "It looks fine." · "I reviewed it as I wrote it." · "Too small to need review."
**Why it's wrong:** "Looks fine" is the feeling that precedes every shipped bug. Reviewing your own work as you write it is the weakest review there is — same blind spots, same assumptions, at the moment you're most committed to the approach.
**Instead:** Run the persona pass at the depth the complexity calls for (grimoire-review). Trivial changes are exempt *by the skill's own rule* — say so and move on; don't self-exempt by feel.

## Declaring done without verifying (→ grimoire-verify)
**Catch yourself saying:** "Tests should pass." · "That obviously works." · "I'll trust the run I did earlier."
**Why it's wrong:** "Should pass" is a prediction, not evidence. Done is a claim about observed state; an unobserved claim is a guess in a confident voice.
**Instead:** Run it. Confirm every scenario has a real step definition with real assertions and no regressions (grimoire-verify). Evidence over claims — every time.

## Doing more than the task (→ principles.md §4)
**Catch yourself saying:** "While I'm in here I'll also…" · "We'll need it later."
This is scope creep / YAGNI — its home is **`principles.md` §4 (KISS/YAGNI)**, not here. The named flags ("while I'm here", "for a future caller") live there; cut the speculative work and say so in one line.

---

## How skills cite this

- **draft** — *Skipping the spec*, *Silently filling a gap*
- **plan** — *Skipping the plan / vague tasks*
- **apply** — *Code before the test*
- **review** — *Skipping review*
- **verify** — *Declaring done without verifying*

Each skill links its own section; none restate the list. This is the one home (DRY).
