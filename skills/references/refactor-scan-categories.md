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
