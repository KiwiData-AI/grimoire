# Pattern Guard Reference

Loaded by `grimoire-apply` and `grimoire-bug`. Run **before writing the test** for each task — not after, not as a review pass. The goal is to write code that matches the codebase's established conventions the first time, rather than writing to generic patterns and fixing divergence later.

This is not a quality checklist. It is a reconnaissance step: find out how this codebase already solves this class of problem, then write to that pattern.

Requires `codebase-memory-mcp` indexed. If the graph is not available, skip this reference entirely and rely on `code-quality.md` alone.

---

## Run Before Each Task

### Step 1 — Classify the code being written

From the task description and feature file, identify what category of code this task produces:

| Code type | Examples |
|---|---|
| `api_handler` | Route handler, view, controller, endpoint function |
| `service` | Use case, interactor, domain service, business logic function |
| `repository` | Data access, ORM query, store method, DAO |
| `model` | ORM model, dataclass, schema, type definition |
| `utility` | Helper, formatter, validator, parser |
| `test` | Step definition, unit test, fixture, factory |
| `middleware` | Auth, logging, rate-limiting, request transform |
| `integration` | External API client, webhook handler, adapter |

A task may touch multiple types — classify the primary one.

### Step 1b — Reuse discovery

Before finding peer patterns, ask: **does what I'm about to write already exist?**

These are two different questions. Step 2 finds code to *pattern-match against*. This step finds code to *call instead of writing*.

For each function, helper, or class the task requires, run both searches:

**Semantic search** — find it by concept, not by name:
```
search_graph(semantic_query=["<primary_concept>", "<action_verb>", "<domain_noun>"])
```
Example: about to write something that formats a currency amount →
```
search_graph(semantic_query=["format", "currency", "amount"])
```
This finds `render_price`, `display_amount`, `format_currency` — whatever name the codebase already uses.

**Name-pattern search** — find it by likely prefix or suffix:
```
search_graph(name_pattern="(format_|_format|currency|amount|price)")
```

**Decision rules:**
- Result does the job → **call it**. Do not re-implement.
- Result almost fits → **use it directly**. Do not generalize it for a second case that doesn't exist yet.
- Both searches return nothing usable → write new code and proceed to Step 2.

**Log the outcome in the pattern brief** (Step 4): note which searches ran and what they found. If calling an existing function instead of writing new code, note it explicitly: `Reused format_currency from billing/utils.py — no new function needed.`

Do not skip this step. Writing new code without a reuse search is the primary source of duplication in LLM-generated codebases. The semantic_query mode bridges vocabulary gaps — it finds "publish" when you search "send".

### Step 2 — Find peer examples

Use `search_graph` to find 3–5 existing functions/classes of the same type. Prefer the most established (oldest, least recently changed) — these are the modal pattern, not the recent drift.

**Queries by code type:**

```
api_handler:   search_graph(label="Function", name_pattern="(handle|view|endpoint|get_|post_|put_|delete_|patch_)")
service:       search_graph(label="Function", name_pattern="(service|use_case|create_|update_|delete_|process_)")
repository:    search_graph(label="Function", name_pattern="(repo|get_by|find_by|list_|save_|delete_)")
model:         search_graph(label="Class", name_pattern="(Model|Schema|DTO|Type|Entity)")
utility:       search_graph(label="Function", name_pattern="(parse_|format_|validate_|convert_|build_)")
test:          search_graph(label="Module", name_pattern="(test_|_test|spec|_spec|conftest|fixture)")
middleware:    search_graph(label="Function", name_pattern="(middleware|guard|interceptor|filter|auth)")
integration:   search_graph(label="Class", name_pattern="(Client|Adapter|Gateway|Connector|Webhook)")
```

If the query returns > 10 results, filter to the same area as the task's target file (check area docs or directory).

Exclude files changed in the last 60 days from your sample — those may already be drifted. Use `git log --since="60 days ago" --name-only --format=` to get the recent list.

If < 3 peers exist in the graph, skip the pattern brief — there's no established pattern yet. Write to `code-quality.md` rules and the feature spec only.

### Step 3 — Extract the modal pattern

`get_code_snippet(qualified_name)` for each peer. Read across all samples and identify:

**Four critical seams** (these are the ones that cause architectural drift if broken):

1. **Error handling** — Does this codebase raise exceptions or return result/error values at this layer? Do handlers catch specific exception types? Is there a central error handler or per-function handling?

2. **Dependency access** — Are dependencies injected (constructor, function arg) or imported directly? Is there an established pattern (DI container, FastAPI `Depends`, Django `self.repository`, etc.)?

3. **Abstraction depth** — Does this code type contain business logic, or does it delegate? (e.g., handlers should be thin, services should be thick — but check what *this* codebase actually does)

4. **Return shape** — Dict? Typed dataclass/schema? Model instance? Tuple `(result, error)`? Pydantic model? Match exactly.

**Three secondary seams** (style drift, not architecture):

5. **Naming** — snake_case vs camelCase beyond language default, verb-first vs noun-first for functions, consistent abbreviation patterns

6. **Test structure** — `pytest` fixtures vs factories vs inline setup? `unittest.mock` vs `pytest-mock`? Arrange/Act/Assert comments or no?

7. **Import order / grouping** — stdlib → third-party → local? Relative vs absolute imports?

### Step 4 — Write the pattern brief

Produce a short, concrete brief of 5–8 rules derived from the samples. Not generic rules — rules for *this task in this codebase*. Example:

```
Pattern brief for: POST /invoices handler (api_handler)

From 4 peers (billing/views.py, orders/views.py, customers/views.py, auth/views.py):

1. Error handling: raise ValidationError / NotFound — do NOT return {"error": ...}. 
   Central handler in middleware/errors.py converts exceptions to HTTP responses.
2. Dependency: inject service via constructor arg — `def __init__(self, invoice_service: InvoiceService)`
   Do NOT call InvoiceService() inline.
3. Abstraction: handler validates request, calls one service method, serializes response.
   No business logic in the handler.
4. Return shape: return InvoiceSerializer(result).data with DRF Response — not a raw dict.
5. Naming: method names are HTTP verb — `def post(self, request)` not `def create_invoice`.
```

This brief is your constraint set for this task. Apply it while writing — not as a review after.

### Step 5 — Write to the brief

When writing the test and production code for this task:

- Apply the brief's rules as hard constraints, not suggestions
- If the task spec conflicts with the brief (e.g., feature file implies a return shape the codebase doesn't use), flag it to the user before writing — don't silently choose one
- If you must deviate from the brief (e.g., the brief's pattern won't work for this specific case), note the deviation inline with a comment explaining why, and add it to the handoff note

### Step 6 — Verify called functions exist

After writing production code, before running tests:

Extract every external function/method call your new code makes (exclude stdlib and known third-party packages). For each:

```
search_graph(name_pattern="<function_name>")
```

If a called function is not found in the graph:
- Check the import — is it an alias or renamed import?
- Check for typos against similar names in the graph
- If genuinely missing: **stop**. Do not call a function that doesn't exist. Either find the correct function via `search_graph` or flag to the user.

This catches hallucinated API calls before they become broken tests.

---

## Pattern Brief Template

```
Pattern brief for: <task title> (<code_type>)

From <N> peers (<file1>, <file2>, ...):

1. Error handling: <what the peers do>
2. Dependency: <injection pattern used>
3. Abstraction: <what this layer does vs delegates>
4. Return shape: <concrete type/shape>
5. Naming: <any non-obvious conventions>
[6. Test structure: <if this is a test task>]
[7. Deviation noted: <if you must deviate, why>]
```

Write the brief into the task's handoff note in `tasks.md` so future sessions have it.

---

## When to Skip

- Graph not indexed → skip entirely, use `code-quality.md` only
- < 3 peers found → skip the brief, note "no established pattern yet"
- Task is adding a new code type with no prior examples → skip the brief, note "first of this type"
- Hotfix / bug task in `grimoire-bug` → run only Step 6 (hallucination check); skip the full brief to avoid over-constraining the fix
