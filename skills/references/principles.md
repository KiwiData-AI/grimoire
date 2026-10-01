# Grimoire Design Principles

Four principles govern every grimoire artifact and every change. `grimoire-draft`,
`grimoire-plan`, and `grimoire-review` each enforce them at their own stage. They
are not style preferences — they are gates. A draft, plan, or design that violates
one without a stated reason is rejected, not merged.

This file is the single home for the principles (it practices what it preaches —
the skills cite it rather than restating it).

---

## 1. One right way to do a thing

There is exactly **one** sanctioned way to do each thing in the codebase, and one
authoritative home for each fact. Two ways to do the same thing is a defect, even
if both work.

- One capability → one feature spec. One decision → one MADR. One constraint → one
  register entry. One fact → one home. No capability described in three places.
- When a second mechanism appears for an existing job, the right move is to delete
  one and converge — never to keep both "for flexibility."
- **Tell:** "we could do it this way *or* that way" in a spec/plan. Pick one. Record
  why in a MADR if the choice is non-obvious; don't leave both paths in the code.

## 2. DRY — don't repeat yourself

Every piece of knowledge has a single, unambiguous representation.

- Don't store what's derivable. Code structure comes from codebase-memory-mcp on
  demand — never freeze it into a doc that drifts. Generated overviews regenerate;
  they are not hand-edited.
- Reuse before write: search the graph for an existing function/utility before
  writing a new one. The third occurrence of near-identical code triggers
  consolidation or one explicit user decision to retain duplication. Do not
  abstract before the third occurrence (see KISS).
- Duplication of *content* (the same rule in three skill files, the same constant in
  three modules, the same scenario in feature + MADR) is the target. Eliminate it.

## 3. Don't reinvent the wheel — use existing tools

If an established tool already does a job well, use it. Do not build a parallel
grimoire mechanism that duplicates it.

- **git** is the wheel for change processes: branches = isolation, `git diff` =
  staging, `git log` + PR + commit trailers = history and change identity. Do not
  build change-folder copies, promote/sync steps, or bespoke archive/changelog trees.
- For auth, crypto, parsing, HTTP, queues, etc. — adopt the battle-tested library.
  Never roll custom crypto, custom session management, custom auth tokens.
- Before building any tracking/versioning/state/diff mechanism, ask: does a standard
  tool already in the stack do this? If yes, wire to it.
- **Exception that proves the rule:** when no single standard tool exists (e.g. issue
  tracking is a fractured landscape), don't force-adopt one *and* don't build a
  general-purpose clone. Keep any local mechanism narrow and purpose-scoped.

## 4. Keep it simple (KISS / YAGNI)

The simplest thing that fully solves the *stated* problem wins.

- Least code, fewest new files, smallest surface area. A few lines in an existing
  file beats a new module. A standard-library call beats a new dependency. Inline
  beats a one-line wrapper.
- **YAGNI — no premature abstraction.** You aren't gonna need it. No `BaseX`/factory/
  strategy/config-object for a single caller. No speculative generality "for a future
  second caller" that doesn't exist. Speculative need → skip it, say so in one line.
- Solve the problem in front of you, not the imagined one. Non-goals are real scope
  boundaries — do not plan or build past them.
- **Tell:** an abstraction, indirection, or dependency whose only justification is a
  hypothetical. Cut it.

### Mechanism admission

A new mechanism requires a direct accepted requirement. Models, tables, migrations,
persistent records, caches, temporary storage, signatures, tokens, queues, limits,
configuration values, formats, loaders, route-specific exceptions, middleware paths,
test infrastructure, workflows, abstractions, utilities, registries, and extension
points are mechanisms.

Before adding a mechanism, answer in order:

1. Which accepted user outcome, user-requested decision, or proven constraint fails without it?
2. Which existing project mechanism was considered first?
3. Why is the existing mechanism insufficient?
4. Which new failure modes does the mechanism create?
5. Can deleting the mechanism still satisfy every accepted requirement?

If the first answer names only an implementation preference, omit the mechanism. Do
not replace a working fixture, test infrastructure, loader, or workflow unless an
accepted requirement requests replacement or the existing mechanism concretely blocks
delivery. Extend the existing owner of validation, logging, size policy, temporary
state, or persistence instead of creating a second owner. A constraint created only to
support another new mechanism is evidence that the original mechanism should be
reconsidered.

---

## How the stages apply these

- **draft** — admission-test every artifact: does this fact already have a home
  (one-right-way/DRY)? Is it behavior (→ feature) or a constraint/decision/structure
  (→ its own home, not a feature)? Is there an existing tool/library for it
  (don't-reinvent)? Is the scope the stated problem only (KISS)?
- **plan** — every task names the single approach (one-right-way), reuses before
  writing (DRY), follows a proven pattern / existing tool rather than a bespoke one
  (don't-reinvent), and chooses the least-code option within non-goals (KISS). Flag
  any task that adds an abstraction, dependency, or second mechanism.
- **review** — a dedicated principles pass: hunt for duplicate homes, derivable-but-
  stored facts, reinvented wheels, and speculative complexity. Each is a finding.
- **apply** — stop before implementing a mechanism that lacks the approved plan's
  direct requirement trace.
