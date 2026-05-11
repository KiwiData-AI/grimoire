# Code Quality Reference

Loaded by skills that write production code (`grimoire-apply`, `grimoire-bug`). Run as a checklist **after the test goes green, before marking the task done**. Same shape as the test-quality check — short, concrete, and gated.

LLM-generated code drifts toward predictable failure modes: too many branches, too many guards, too many helpers wrapping single calls, too many names that mean nothing. This reference exists to make those drifts visible while the code is fresh.

Most rules already live in `AGENTS.md` "Engineering Principles" and in the touched area's `.grimoire/docs/<area>.md`. Those win. This file is the concrete checklist; the principles are the source of truth.

---

## Quality Gate (run before marking task `[x]`)

For each production file you wrote or edited, walk the seven checks below. Any failure → fix the code, re-run tests, then re-check. The gate is not a code review — it's a self-check that catches the cheap mistakes before the human reviewer sees them.

### 1. Reuse before write

Before adding a function, helper, type, or constant: grep for it. Check the area doc's reusable-code table if one exists. Check neighbors in the same directory.

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

### 6. No premature abstraction

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

### 7. Comments earn their place

Default: no comments. Add a comment **only** when the *why* is non-obvious — a hidden constraint, a workaround for a specific bug, an invariant that would surprise a future reader.

Drop:
- Comments that restate the code (`# loop over users`).
- Comments referencing the current task / PR / ticket (`# added for issue #123`, `# used by the new flow`). These rot.
- Multi-line docstrings on private functions whose name and signature already say everything.
- Commented-out code. Delete it; git remembers.

Keep:
- One-line "why": the constraint, the gotcha, the link to the spec / ADR.
- Docstrings the project's `comment_style` requires (check `.grimoire/config.yaml`).

Fail: any comment whose removal would not confuse a future reader.

---

## Quick self-check (paste into the task loop)

Before marking a task `[x]`:

- [ ] Searched for existing utilities before writing new ones (§1)
- [ ] No function with more than ~7 branches or ~30 lines without a reason (§2, §3)
- [ ] No guards / try-except / type-checks inside the trust boundary (§4)
- [ ] No locals named `data`, `result`, `temp`, `info`, `obj` — names reveal intent (§5)
- [ ] No new abstractions, interfaces, or wrappers with a single caller (§6)
- [ ] No comments describing *what* the code does — only *why*, and only when non-obvious (§7)
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
