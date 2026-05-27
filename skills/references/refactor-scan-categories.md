# Refactor Scan Categories

Reference for `grimoire-refactor` step 2. Each category produces findings with a category, location, severity, and suggested action.

## 2a. Hotspots (churn x complexity)

Files that change frequently AND are hard to change. Highest-ROI refactoring targets.

**How to scan:**
1. Change frequency: `git log --format=format: --name-only --since="6 months ago" | sort | uniq -c | sort -rn | head -50`
2. Complexity: run `config.tools.complexity` (configured during init — e.g., radon, eslint complexity plugin, or line count + nesting depth as proxy)
3. Multiply: `churn_rank x complexity_rank = hotspot_score`
4. Top 10-20 files by hotspot score are targets

**Severity:** high = top 5 (churn >20 AND complexity above threshold), medium = 6-15, low = 16+

## 2b. Structural Bloat

| Signal | Threshold | Meaning |
|---|---|---|
| Oversized files | >300 lines (Python), >500 (TS/JS), >400 (Go) | File does too much — split |
| Long functions | >50 lines or >4 nesting levels | Extract or flatten |
| God classes | >10 public methods or >500 lines | Split by responsibility |
| Too many exports | >15 from one module | Grab bag, not a module |
| Deep nesting | >4 levels of indentation in logic | Guard clauses, extract, pipeline |
| Wrapper-only layers | Function body is a single delegation call | Inline or remove |
| Large switch/if-else | >5 branches | Lookup table, strategy, polymorphism |

**Severity:** high = 2x+ threshold, medium = 1-2x, low = marginally over

**Graph-powered LLM bloat checks** (requires `codebase-memory-mcp`; skip if not indexed):

These target patterns that static size checks miss — structurally valid code that adds indirection without value. Primary signal of LLM-generated over-engineering.

| Pattern | Query | Flag when |
|---|---|---|
| Single-subclass base class | `query_graph("MATCH (sub)-[:INHERITS]->(base:Class) WITH base, collect(sub) AS subs WHERE size(subs) = 1 RETURN base.qualified_name, base.file, subs[0].qualified_name AS only_subclass")` | Any result — a base with one child is premature abstraction |
| Single-caller wrapper | Step 1: `query_graph("MATCH (caller)-[:CALLS]->(fn) WITH fn, collect(caller) AS callers WHERE size(callers) = 1 RETURN fn.qualified_name, fn.file, callers[0].qualified_name AS only_caller")`. Step 2: for each result, `get_code_snippet(qualified_name)` and count body lines. | Wrapper with 1 caller and ≤7 body lines — inline candidate |
| Zero-caller export | `query_graph("MATCH (f:Function) WHERE f.exported = true AND NOT ()-[:CALLS]->(f) RETURN f.qualified_name, f.file")` — then filter out entry points manually: skip files named `index.ts`, `__init__.py`, `main.py`, `cli.py`, `app.py`, or in a `public/` directory | Exported, unreachable within repo, not an entry point — dead export |
| Single-implementation interface | `query_graph("MATCH (impl)-[:IMPLEMENTS]->(iface:Interface) WITH iface, collect(impl) AS impls WHERE size(impls) = 1 RETURN iface.qualified_name, iface.file, impls[0].qualified_name AS only_impl")` | Any result — interface with one implementor adds no polymorphism |

Note: the exact Cypher depends on the graph schema. If a query returns an error, adjust field names using `get_graph_schema()` to inspect available properties.

**Severity for graph findings:** high = single-implementation interface or zero-caller export, medium = single-subclass base or single-caller wrapper

## 2c. Data Structure Complexity

| Signal | Meaning |
|---|---|
| Models >15 fields | Represents multiple concepts — split |
| >3 nesting levels | Flatten or normalize |
| Type unions >4 variants | Separate types or polymorphism |
| >70% field overlap between types | Consolidate or extract shared base |
| Config with conditional logic | Business logic hiding as config |
| >50% optional fields | God DTO serving multiple use cases |
| Enums >10 values | Proper type hierarchy |

**How to scan:** Read `schema.yml` if exists, scan ORM models / interfaces / dataclasses, count fields and nesting.

**Severity:** high = >25 fields or >4 nesting, medium = 15-25 or 3-4 nesting, low = structural smell but manageable

## 2d. Circular Dependencies

**How to scan:**
- JS/TS: `dependency-cruiser` or `madge` if available, else trace imports from area docs
- Python: trace imports, look for `TYPE_CHECKING` blocks (circular import workaround signal)
- Go: circular imports are compile errors — look for oversized packages to split

**Severity:** high = >3 modules or crosses architecture boundaries, medium = 2-module cycles, low = within single area

## 2e. Dependency Staleness

**How to scan:** Run `config.tools.dep_audit` if configured, or:
- Node: `npm outdated --json`
- Python: `pip list --outdated --format=json`
- Count major versions behind, check last publish date

**Severity:** high = >2 major versions behind or unmaintained (2+ years no release), medium = 1-2 major behind, low = minor/patch behind

## 2f. Broken Promises

TODO/FIXME/HACK/XXX comments that have aged.

**How to scan:**
1. Find comments: `grep -rn 'TODO\|FIXME\|HACK\|XXX' --include="*.py" --include="*.ts" --include="*.js" --include="*.go" ...`
2. Age from `git blame` — when was this line last touched?
3. Older = higher priority

**Severity:** high = >1 year old, medium = 3 months to 1 year, low = <3 months

## 2g. Duplication

**How to scan:**
- Read `.grimoire/docs/.snapshot.json` `duplicates` section if present
- Or run `config.tools.duplicates` if configured (e.g., jscpd)
- Group by area — within-area dupes are easy to consolidate

**Severity:** high = >30 lines or >3 copies, medium = 10-30 lines or 2 copies, low = <10 lines

**Concept-based duplicate detection** (requires `codebase-memory-mcp`; supplements jscpd which only finds textual clones):

LLM-generated code frequently re-implements existing utilities under a different name. jscpd won't catch these — the code is structurally different even though it does the same thing.

**How to scan:**
1. Find utility/helper functions: `search_graph(label="Function", name_pattern="(parse_|format_|validate_|convert_|build_|get_|find_|create_|check_|is_|has_)")`
2. For each result, extract 2–3 concept words from the function name (e.g., `format_invoice_date` → `["format", "date", "invoice"]`)
3. Run: `search_graph(semantic_query=["<concept1>", "<concept2>", "<concept3>"])` — if `semantic_query` is unsupported, fall back to `search_graph(name_pattern="(<concept1>|<concept2>)")`
4. Compare: if the search returns a different function, read both with `get_code_snippet` and assess whether they do the same job

**Flag when:** two functions accept similar inputs, produce similar outputs, and operate on the same domain concept. Assessment is qualitative — the tool returns ranked results, not similarity scores.

**Focus on:** utility directories (`utils/`, `helpers/`, `lib/`, `common/`), validators, formatters, parsers. These are where re-implementations accumulate.

**Severity:** high = identical behavior under different names, medium = near-duplicate with minor variations that could be unified with a parameter, low = similar but distinct enough to keep

## 2h. Dead Code

**How to scan:**
- Run `config.tools.dead_code` if configured (e.g., knip, vulture)
- Cross-reference area docs' reusable code tables (in table but never imported = dead)
- If `codebase-memory-mcp` available: `query_graph` for functions with zero callers

**Severity:** high = entire unused modules/classes, medium = unused exported functions, low = unused imports/variables

## 2i. Test Debt

**How to scan:**
- Get coverage report if available — files <50% coverage
- Cross-reference with complexity — high complexity + low coverage = dangerous
- Check for trivial assertions (`assert True`, `expect(true).toBe(true)`)
- Check for over-mocked tests (testing mocks, not behavior)

**Severity:** high = complex code (top quartile) with <30% coverage, medium = moderate complexity with <50%, low = simple code with low coverage

## 2j. Pattern Divergence

Code that solves a problem in a way that contradicts how the codebase already solves the same class of problem. The primary AI slop signal — structurally valid code that ignores established conventions and accumulates architectural drift.

**Requires:** `codebase-memory-mcp` indexed. Skip this category if graph is not available.

**How to scan:**

**Step 1 — Identify peer groups**

A peer group is a set of nodes in the graph that share the same role. Use `search_graph` to find them:

| Peer group | Query |
|---|---|
| API/route handlers | `search_graph(label="Function", name_pattern="(handle|view|endpoint|route|controller)")` |
| Service methods | `search_graph(label="Function", name_pattern="(service|use_case|interactor)")` |
| Repository/data access | `search_graph(label="Function", name_pattern="(repo|repository|store|dao|query)")` |
| Test files | `search_graph(label="Module", name_pattern="(test_|_test|spec)")` |
| Error handlers | `search_graph(label="Function", name_pattern="(error|exception|fail|catch)")` |

Supplement with area docs if available — each area doc lists files by role.

**Step 2 — Extract modal pattern per peer group**

For each peer group with ≥3 members, sample 3-5 established members (oldest by `git log`, not recently changed):
- `get_code_snippet(qualified_name)` for each sample
- Identify the modal pattern across: error handling style, dependency access (injected vs imported), abstraction depth (business logic in handler vs delegated to service), naming convention, return type shape

This is the **baseline** — what the codebase already does.

**Step 3 — Compare recent code against baseline**

Scope: files changed in the last 60 days (`git log --since="60 days ago" --name-only --format=`). Cross-reference with the peer groups from step 1.

For each recently changed file that belongs to a peer group:
1. `get_code_snippet` for the changed function/class
2. Compare against the modal pattern from step 2
3. Flag if it diverges on any of the four critical seams (see below)

**Step 4 — Flag divergences**

Only flag divergence on seams that matter architecturally. Cosmetic drift (whitespace, docstring style) is not a debt item.

| Seam | Divergence signal | Example |
|---|---|---|
| **Error handling** | Mix of exception-raise vs return-value-error in same layer | Most handlers raise `ValueError`; new one returns `{"error": ...}` |
| **Data access** | Bypass of established access layer | Most services call `repo.get()`; new one imports ORM model directly |
| **Abstraction depth** | Business logic at wrong layer | All handlers delegate; new handler contains domain logic inline |
| **Dependency wiring** | Injected vs hardcoded import for same dependency | All services receive `db` via constructor; new one calls `get_db()` directly |
| **Test structure** | Different test strategy in same area | All tests in area use factory fixtures; new tests use heavy mocks |

**Step 5 — Check for hallucinated or non-existent references**

Use `search_graph` to verify function calls in recently changed files:
- Extract all function calls in the diff using `search_code(pattern)` or `get_code_snippet`
- For each called function/method: `search_graph(name_pattern=<name>)` — does it exist?
- Missing = hallucinated API, deprecated method, or invented config option

Flag as `pattern_divergence` with detail: "Called `foo.bar()` — no matching node in graph."

**Severity:**
- high = divergence at a core architectural seam (data access, error handling, auth) OR hallucinated reference
- medium = wrong abstraction layer or dependency wiring inconsistency
- low = test strategy divergence or naming/convention drift

**Suggested action (per seam):**
- Error handling: align to codebase's exception or result pattern
- Data access: route through established repository/service layer
- Abstraction: extract domain logic to service, slim the handler
- Dependency: adopt constructor injection or established DI pattern
- Hallucinated ref: replace with actual existing function (use `search_graph` to find it)

## 2k. Comment Noise

Comments that restate the code, reference stale context, or pad function bodies without conveying non-obvious intent. A secondary LLM bloat signal — LLMs are trained to produce documentation and carry that habit into code generation.

**How to scan:**

**Step 1 — High comment density files**
```bash
grep -rcE "^\s*#|^\s*//" --include="*.py" --include="*.ts" --include="*.js" <src_dirs> | \
  grep -v ":0$" | sort -t: -k2 -rn | head -20
```
Flag files with >30 comment lines. Raw count, not ratio — a 30-comment file is a candidate regardless of size.

**Step 2 — Restatement pattern grep**
```bash
grep -rni \
  -e "# loop over" -e "# iterate over" -e "# return the" -e "# return result" \
  -e "# loop through" -e "# now call" -e "# call the" -e "# increment" -e "# decrement" \
  -e "// loop over" -e "// iterate over" -e "// return the" -e "// return result" \
  -e "// loop through" -e "// now call" -e "// call the" -e "// increment" -e "// decrement" \
  --include="*.py" --include="*.ts" --include="*.js" <src_dirs>
```
Treat results as candidates — quick human scan to confirm before deleting.

**Step 3 — Task/PR reference comments**
```bash
grep -rn \
  -e "# added for" -e "# used by" -e "# see issue" -e "# handles the case" -e "# added in" \
  -e "// added for" -e "// used by" -e "// see issue" -e "// handles the case" -e "// added in" \
  --include="*.py" --include="*.ts" --include="*.js" <src_dirs>
```
These belong in commit messages, not source. Treat results as candidates — review before flagging, as patterns like `# see issue` can appear in legitimate context.

**Step 4 — Docstrings on private/internal functions**
```bash
# Python: single-underscore private functions (excludes dunders)
grep -rn "def _[^_]" --include="*.py" <src_dirs>
# TS/JS: JSDoc blocks
grep -rn "/\*\*" --include="*.ts" --include="*.js" <src_dirs>
```
Manual triage: open each hit and check whether a multi-line docstring follows. Python `def _name` functions and TS/JS non-exported functions don't need docstrings. Delete multi-line blocks; a single-line doc is acceptable if `comment_style` requires it.

**Severity:**
- high = >20 restatement comments in a single file, or task/PR references in core business logic
- medium = 5–20 restatement comments, or any task/PR references found
- low = multi-line docstrings on private functions

**Suggested action:** Delete restatement comments. Move task/PR references to commit history. Trim private function docstrings to one line or remove entirely.
