# Code Quality Reference

Loaded by skills that write production code (`grimoire-apply`, `grimoire-bug`). Run as a checklist **after the test goes green, before marking the task done**. Same shape as the test-quality check — short, concrete, and gated.

LLM-generated code drifts toward predictable failure modes: too many branches, too many guards, too many helpers wrapping single calls, too many names that mean nothing. This reference exists to make those drifts visible while the code is fresh.

Most rules already live in `AGENTS.md` "Engineering Principles" and in the touched area's `.grimoire/docs/<area>.md`. Those win. This file is the concrete checklist; the principles are the source of truth.

---

## Quality Gate (run before marking task `[x]`)

For each production file you wrote or edited, walk the seven checks below. Any failure → fix the code, re-run tests, then re-check. The gate is not a code review — it's a self-check that catches the cheap mistakes before the human reviewer sees them.

### 1. Reuse before write

Before adding a function, helper, type, or constant: query the graph (`search_graph` by concept and by name) for an existing one. Then grep, and check neighbors in the same directory.

- If a function with the same job already exists → call it. Don't re-implement.
- If something *almost* fits → use it directly first, refactor it once a second caller actually needs the change. Don't generalize on speculation.
- If you wrote a helper used by exactly one caller → inline it. Helpers earn their name through reuse.

Fail: two near-identical functions, parallel utility files, a private helper next to a public one that already does the same thing.

### 2. Branching budget

Count branches per function: every `if`, `else if`, `case`, `&&`/`||` in a condition, ternary, `try/except` arm, early-return guard. Aim for ≤ 7. Above that, the function does too much.

Fixes (in order of preference):
1. Delete branches that guard impossible states (see §4).
2. Replace nested `if`/`else` ladders with early returns or a lookup table / dict.
3. Split the function — one job per function. If the function name needs "and", split it.

Fail: a 60-line function with four levels of nesting, or any function whose flow can't be described in one sentence.

### 3. Function and file size

- Function body > ~30 lines → look for a split. A long function is usually two functions in a trenchcoat.
- File > ~300 lines → look for a split, unless the project's neighbors are larger.
- One function should do one thing. If naming it forces "and" / "or" / "_helper", split first.

Don't split just to hit a number. A 40-line function that reads top-to-bottom and does one thing is better than four 10-line functions that bounce around.

### 4. No defensive code inside the trust boundary

Validate at the edges (user input, external API responses, file/network reads). Inside, trust your callers and your types.

Drop:
- `if x is None` guards on values the type system says can't be None.
- `try/except` that catches an exception you have no plan for and re-raises or logs-and-continues.
- "Just in case" type checks (`isinstance`), length checks, key-exists checks on dicts you just built.
- Fallback values for branches that can't be reached.

Keep:
- Validation of payload from a request/response/file.
- Error handling at a real boundary with a real recovery path (retry, user message, fallback service).

Fail: a private function with three guard clauses before its one real line.

### 5. Names reveal intent

- Locals: name the thing, not its type. `users`, not `user_list`. `unpaid_invoices`, not `data` / `result` / `temp` / `info`.
- Booleans: read as a yes/no question. `is_expired`, `has_admin_role`, `should_retry` — not `flag`, `check`, `status`.
- Functions: verb phrase that says what it does. `parse_invoice(raw)` not `process_data(d)`.
- No `_v2`, `_new`, `_helper`, `_util`, `_handler` suffixes unless the project's neighbors use them.
- Single-letter names only for indices in tight loops and well-known math conventions (`i`, `j`, `x`, `y`).

Fail: any local named `data`, `result`, `temp`, `obj`, `item`, or `value` when a more specific name fits.

### 6. No premature abstraction (YAGNI)

Three near-identical copies is acceptable. Extract on the fourth, or when the shared shape is stable and named. Wrong abstractions are harder to undo than duplication.

Drop:
- Generic interfaces with one implementation.
- Config objects with one caller and one shape.
- "Strategy" / "factory" / "registry" patterns added without a second case actually needing them.
- Wrapper functions that only rename arguments.

Keep:
- Abstractions the codebase already uses for this kind of thing — follow the neighbor.
- Boundaries called out in an accepted ADR.

Fail: a new `BaseFoo` / `FooStrategy` / `FooFactory` introduced for a single caller.

### 7. Comments earn their place — terse, self-contained, no essays

Write comments like a senior engineer with no time: dense, professional, zero filler.

**Voice: terse.** "Resolve model by id; raises on unknown provider." — not "This function is responsible for resolving the model by its id, and it will raise an exception if the provider is not known." Drop "this function", "we", hedging, and restated types. Fragments are fine; full prose grammar is not required.

**Self-contained.** A comment describes the function/class on its own terms only. It must NOT name an external artifact that changes independently — feature flags / `.feature` files / scenario names, unit or integration test names, MADR/ADR numbers, change-ids, issue/PR numbers, tag codes (`LOG-OBS-003`). Those orphan the moment the artifact moves, and rot silently. Describe the *behavior*, not where it's specced.
- OK: `# skip third-party sinks (e.g. behave capture)` — generic, about the code.
- Not OK: `# implements scenario LOG-OBS-003 from logging.feature` — points at an artifact that will move.

**No paragraphs.** Summary is one line, two at most. No prose block explaining the whole design before the params. If the rationale needs a paragraph, it belongs in a decision record — not the code.

**Params per `comment_style` are fine.** If the project's style (sphinx/google/jsdoc/…) calls for `:param`/`Args:`/`@param`, keep them — but describe a param only when its name + type don't already say it, and don't precede them with prose.

Drop:
- Comments that restate the code (`# loop over users`).
- Any reference to a task / PR / ticket / feature / scenario / ADR / specific test (`# added for issue #123`, `# covers scenario X`, `# see test_foo`). Self-contained or gone.
- Multi-line prose docstrings on private functions whose name + signature already say everything.
- Commented-out code. Delete it; git remembers.

Keep:
- One terse line of *why* when non-obvious — a hidden constraint, a workaround, a surprising invariant — stated in terms of the code itself.
- The structured `comment_style` param/return section, terse.

Fail: any comment that (a) wouldn't confuse a future reader if removed, (b) names an external artifact, or (c) runs to a prose paragraph.

**Before / after** (the offender this rule targets):
```python
# BEFORE — orphan-prone essay
def build_chat(model_id):
    """
    Build and return a chat model for the given model id. This is the primary
    entry point used by every agent and team in the system, as specified by
    scenario LOG-OBS-003 in logging.feature and decided in ADR-0001. See
    test_build_chat for the expected behavior. Added as part of add-2fa-login.

    :param model_id: the id of the model to build
    :return: the chat model
    """

# AFTER — terse, self-contained
def build_chat(model_id):
    """Resolve a chat model by id. Raises on an unknown provider.

    :param model_id: provider-prefixed model id (e.g. "gpt-4.1-mini")
    """
```

---

## Quick self-check (paste into the task loop)

Before marking a task `[x]`:

- [ ] Searched for existing utilities before writing new ones (§1)
- [ ] No function with more than ~7 branches or ~30 lines without a reason (§2, §3)
- [ ] No guards / try-except / type-checks inside the trust boundary (§4)
- [ ] No locals named `data`, `result`, `temp`, `info`, `obj` — names reveal intent (§5)
- [ ] No new abstractions, interfaces, or wrappers with a single caller (§6)
- [ ] Comments are terse, self-contained, ≤2 lines of prose — no *what*, no external-artifact refs (feature/scenario/ADR/test/ticket) (§7)
- [ ] Diff stays inside the task's scope — no "while I'm here" refactors

If any box can't be ticked, fix the code (not the checklist) and re-run tests.

---

## Anti-patterns by symptom

| Symptom | Likely cause | Fix |
|---|---|---|
| Function is 80 lines with 5 levels of nesting | Too many jobs, defensive guards | Split + drop dead guards (§2, §3, §4) |
| Three helper files for one feature | Premature abstraction | Inline back, extract once a real second caller exists (§6) |
| `data`, `result`, `obj` everywhere | Generic names from training data | Rename to the actual concept (§5) |
| Every function starts with `if x is None: return` | Defensive habit | Trust the caller; validate once at the edge (§4) |
| Comments restate variable names | Filler | Delete (§7) |
| `try: ... except Exception: pass` | Hiding bugs | Remove or handle the specific exception with a real recovery (§4) |
| Wrapper `def get_user(id): return db.get_user(id)` | Pointless indirection | Inline (§1) |
| Two near-identical functions differing by one constant | Copy-paste instead of reuse | Pass the constant as a parameter, or call the existing one (§1) |

---

## Notes for the reviewer / self

- The gate is **per file, per task**. Not a separate review pass.
- "I'll clean it up later" is the failure mode. Clean it before the test goes green stays green.
- If a check seems wrong for *this* codebase, the project's `AGENTS.md` / area doc / neighbor patterns win. Cite the override; don't ignore silently.
- The full review-stage Senior Engineer + Code Style personas (`./review-personas.md`) catch what slipped through. This gate exists so they have less to catch.
