---
name: grimoire-refactor
description: Systematically find, prioritize, and plan tech debt reduction. Use when the user wants to identify and address code quality issues, complexity, or duplication.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-refactor

Systematically find, prioritize, and plan tech debt reduction. Combines automated scanning with LLM analysis to produce a prioritized debt register, then feeds approved items into the standard grimoire pipeline (draft → plan → apply).

## Triggers
- User asks about tech debt, code quality, refactoring opportunities, or simplification
- User wants to reduce complexity, lines of code, or structural bloat
- User asks "what should we clean up?" or "where's the tech debt?"
- Loose match: "refactor", "tech debt", "simplify", "clean up", "reduce complexity", "code smells"

## Prerequisites
- A grimoire-initialized project (`.grimoire/` exists)
- Git history available (hotspot analysis needs `git log`)
- Ideally: `grimoire map` + `/grimoire:discover` already run (area docs help contextualize findings)

## Debt Item Format

Each debt item in the register follows a structured format influenced by the CodeClimate issue spec (categories, severity, remediation effort, fingerprint) and the SEI/CMU Technical Debt Item classification (consequences, causes, evidence of accumulation).

**Required fields:**
- `id` — unique identifier (debt-NNN, monotonically increasing)
- `category` — one of: `hotspot`, `structural_bloat`, `data_structure`, `circular_dependency`, `dependency_staleness`, `broken_promise`, `duplication`, `dead_code`, `test_debt`
- `severity` — `high`, `medium`, or `low`
- `location` — file path (with optional `:line`), or `path ↔ path` for relationships
- `title` — short human-readable summary
- `detail` — evidence: what was measured, what threshold was exceeded, what the consequences are
- `fingerprint` — stable hash of category + location for dedup across scans (so re-scans update existing items rather than creating duplicates)
- `status` — `open` | `triaged` | `in-progress` | `resolved` | `accepted`

**Optional fields:**
- `metrics` — numeric measurements (churn count, complexity score, line count, field count, age in days, etc.)
- `suggestion` — recommended refactoring approach
- `effort` — `small` (<1 hour), `medium` (1-4 hours), `large` (>4 hours)
- `consequences` — what happens if this debt is NOT addressed (SEI/CMU field — forces articulation of impact)
- `causes` — how this debt was introduced: `evolution` (grew over time), `deadline` (time pressure), `knowledge` (didn't know better), `dependency` (forced by external constraint)
- `quadrant` — Fowler's classification: `deliberate-prudent`, `deliberate-reckless`, `inadvertent-prudent`, `inadvertent-reckless`
- `change_id` — grimoire change created to address this item
- `first_detected` — date the scanner first found this item (set once, never updated)
- `last_detected` — date of most recent scan that confirmed this item still exists

## Debt Exceptions

The scanner respects `.grimoire/debt-exceptions.yml` — a file where the team explicitly accepts known debt. This is modeled on `.snyk`/`.trivyignore` policy files: accept specific items with a reason, an owner, and an optional expiry date.

**Exception matching (checked before any item is added to the register):**

1. **By item ID** — matches a specific debt register entry:
   ```yaml
   - id: debt-003
     reason: "Splitting config types would break the plugin API."
     quadrant: deliberate-prudent
     owner: fred
     accepted: 2026-04-06
     expires: 2026-10-01
   ```

2. **By pattern + category** — matches any finding in files matching the glob:
   ```yaml
   - pattern: "src/vendor/**"
     category: "*"              # or a specific category
     reason: "Vendored code — we don't own it"
     quadrant: deliberate-prudent
     owner: fred
     accepted: 2026-04-06
   ```

**Exception rules:**
- Every exception MUST have `reason`, `quadrant`, `owner`, and `accepted` fields. Exceptions without a reason are rejected — the point is to force articulation of the trade-off.
- `expires` is optional. If set, the scanner re-flags the item after the expiry date and notes it as "exception expired" in the register.
- `quadrant` uses Fowler's Technical Debt Quadrant to classify the *intent* behind accepting the debt. This isn't just documentation — it helps the team spot patterns (too many `deliberate-reckless` exceptions = systemic problem).
- When the scanner finds a matching exception, the item is still recorded in the register but with `status: accepted` and a reference to the exception. This means the debt is visible and tracked, just not flagged for action.
- Expired exceptions cause the item's status to revert to `open` with a note: `"Exception expired YYYY-MM-DD — re-evaluate"`.
- When a user marks an item as "accept" during the triage flow (step 4), the skill writes the exception to `debt-exceptions.yml` automatically — the user provides the reason, quadrant, and optional expiry interactively.

**Scanner behavior with exceptions:**
```
for each finding:
  1. compute fingerprint (category + normalized location)
  2. check debt-exceptions.yml:
     a. match by id? → status: accepted, skip flagging
     b. match by pattern + category? → status: accepted, skip flagging
     c. matched but expired? → status: open, note "exception expired"
     d. no match → status: open, include in findings
  3. check existing register:
     a. fingerprint exists? → update last_detected, preserve status
     b. fingerprint new? → add as new item with first_detected = today
```

## Workflow

### 1. Determine Scope
Ask the user what to scan:
- **Full scan** — all categories across the whole codebase (default for first run)
- **Category scan** — specific debt category (e.g., "just hotspots" or "just structural bloat")
- **Area scan** — specific directory or module (e.g., "just the API layer")
- **Refresh** — re-scan and update an existing debt register

Check if `.grimoire/docs/debt-register.yml` already exists — don't redo work unless refreshing.

### 2. Run Scans

Run applicable scans in parallel. Each scan produces a list of findings with a category, location, severity, and suggested action.

#### 2a. Hotspots (churn × complexity)
The single most valuable tech debt signal. Files that change frequently AND are hard to change are where refactoring pays off most.

**How to scan:**
1. Get change frequency: `git log --format=format: --name-only --since="6 months ago" | sort | uniq -c | sort -rn | head -50`
2. Get complexity: use the configured complexity tool (radon, eslint complexity plugin) or count lines + nesting depth as a proxy
3. Multiply: `churn_rank × complexity_rank = hotspot_score`
4. Top 10-20 files by hotspot score are your targets

**Severity:**
- **high** — top 5 hotspots (churn > 20 commits AND complexity above threshold)
- **medium** — files 6-15
- **low** — files 16+

#### 2b. Structural Bloat
Code that is larger or more complex than it needs to be. The goal is simplification — fewer lines, fewer files, fewer concepts.

**What to scan for:**

| Signal | Threshold | What it means |
|--------|-----------|--------------|
| **Oversized files** | >300 lines (Python), >500 lines (TS/JS), >400 lines (Go) | File is doing too much — split by responsibility |
| **Long functions/methods** | >50 lines or >4 levels of nesting | Function is doing too much — extract or flatten |
| **God classes** | >10 public methods or >500 lines | Class has multiple responsibilities — split it |
| **Too many exports** | >15 exports from a single module | Module surface area is too large — it's a grab bag, not a module |
| **Deep nesting** | >4 levels of indentation in logic (not data) | Hard to follow — use guard clauses, extract functions, pipeline patterns |
| **Wrapper-only layers** | Function/class that just delegates to another with no added logic | Unnecessary indirection — inline or remove |
| **Large switch/if-else chains** | >5 branches in a single conditional | Consider lookup tables, strategy pattern, or polymorphism |

**How to scan:**
- Read each source file (or use area docs for a faster pass)
- Count lines, functions, classes, nesting depth, export count
- Flag anything over threshold
- For wrapper detection: look for functions whose entire body is a single call to another function (with maybe argument reshuffling)

**Severity:**
- **high** — files/functions 2x+ over threshold
- **medium** — files/functions 1-2x over threshold
- **low** — marginally over threshold

#### 2c. Data Structure Complexity
Over-engineered models, deeply nested types, and data structures that have grown beyond their purpose.

**What to scan for:**

| Signal | What it means |
|--------|--------------|
| **Models with >15 fields** | Model is probably representing multiple concepts — consider splitting |
| **Deeply nested objects** (>3 levels) | Hard to access, hard to validate, hard to serialize — flatten or normalize |
| **Type unions with >4 variants** | The type is trying to be too many things — polymorphism or separate types |
| **Duplicate structures** | Two types/interfaces with >70% field overlap — consolidate or extract shared base |
| **Config-as-code** | Config or constant files with conditional logic, computed values, or business rules — this is business logic hiding as config |
| **Excessive optional fields** | >50% of fields are optional — probably a "god DTO" serving multiple use cases |
| **Enum sprawl** | Enums with >10 values or enums used as dispatch tables — consider a proper type hierarchy |

**How to scan:**
- Read `schema.yml` if it exists (pre-computed data model)
- Scan ORM models, TypeScript interfaces/types, dataclasses, Pydantic models
- Count fields, nesting depth, optional ratio
- Cross-reference with area docs for duplicate detection

**Severity:**
- **high** — models with >25 fields or >4 levels of nesting
- **medium** — models with 15-25 fields or 3-4 levels of nesting
- **low** — models with structural smell but manageable size

#### 2d. Circular Dependencies
Modules that import each other create tight coupling and make changes ripple unpredictably.

**How to scan:**
- For JS/TS: use `dependency-cruiser` or `madge` if available, otherwise trace imports manually from area docs
- For Python: trace imports across modules, look for `TYPE_CHECKING` blocks (often a sign of circular import workarounds)
- For Go: circular imports are compile errors, so look for large packages that should be split

**Severity:**
- **high** — cycles involving >3 modules or crossing architectural boundaries
- **medium** — 2-module cycles
- **low** — cycles within a single area/feature

#### 2e. Dependency Staleness
Packages that are unmaintained or far behind the latest version. Not just security (that's dep_audit) — maintenance burden and ecosystem drift.

**How to scan:**
- `npm outdated --json` or `pip list --outdated --format=json` or equivalent
- Count major versions behind
- Check last publish date if available
- Flag packages >2 major versions behind or with no update in >2 years

**Severity:**
- **high** — >2 major versions behind or unmaintained (no release in 2+ years)
- **medium** — 1-2 major versions behind
- **low** — minor/patch versions behind

#### 2f. Broken Promises
TODO, FIXME, HACK, and XXX comments that have aged. These are explicit acknowledgements of debt.

**How to scan:**
1. Find all TODO/FIXME/HACK/XXX comments: `grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.ts" ...`
2. For each, get age from `git blame` — when was this line last touched?
3. Older = higher priority (a 2-year-old TODO is a broken promise; a 2-day-old TODO is active work)

**Severity:**
- **high** — >1 year old
- **medium** — 3 months to 1 year
- **low** — <3 months (probably active work, may not be debt yet)

#### 2g. Duplication
Code clones that should be consolidated. Leverages existing `grimoire map --duplicates` or jscpd data.

**How to scan:**
- Read `.grimoire/docs/.snapshot.json` `duplicates` section if present
- Or run `jscpd` if configured
- Group duplicates by area — duplicates within an area are easy to consolidate; cross-area duplicates may need a shared utility

**Severity:**
- **high** — >30 duplicated lines or >3 copies of the same block
- **medium** — 10-30 duplicated lines or 2 copies
- **low** — <10 lines

#### 2h. Dead Code
Unused exports, unreachable branches, unused imports. Leverages existing tools (knip, vulture, etc.).

**How to scan:**
- Run configured dead code tool from `config.yaml`
- Or use LLM analysis on changed files
- Cross-reference with area docs' reusable code tables (if something is in the reuse table but never imported, it's dead)

**Severity:**
- **high** — entire unused modules or classes
- **medium** — unused exported functions
- **low** — unused imports or variables

#### 2i. Test Debt
Complex code that lacks test coverage. Combines complexity data with coverage data.

**How to scan:**
- Get coverage report (if available) — identify files with <50% coverage
- Cross-reference with complexity — files with high complexity AND low coverage are dangerous
- Check for test files that have only trivial assertions (`assert True`, `expect(true).toBe(true)`)
- Check for test files that mock everything (testing mocks, not behavior)

**Severity:**
- **high** — complex code (top quartile) with <30% coverage
- **medium** — moderate complexity with <50% coverage
- **low** — simple code with low coverage (less risky)

### 3. Load Exceptions

Before generating the register, read `.grimoire/debt-exceptions.yml`. Parse all exceptions and build a lookup:
- Index by `id` for direct item matches
- Index by `pattern` + `category` for glob matches
- Check `expires` dates — any exception past its expiry date is treated as not matching (the item will be flagged as `open` with a note)

If the exceptions file doesn't exist, proceed with no exceptions (all findings are flagged).

### 4. Generate Debt Register

Produce `.grimoire/docs/debt-register.yml`. This is the persistent record of known debt, what's been triaged, and what's been addressed.

For each finding from the scans:
1. Compute a fingerprint: `sha256(category + normalized_location)` — this is the stable identifier for dedup across scans
2. Check against exceptions (by id, then by pattern+category)
3. Check against existing register (by fingerprint) — preserve status and metadata for known items
4. Add or update the item in the register

```yaml
# Grimoire Debt Register
# Generated by /grimoire:refactor
# Last scanned: 2026-04-06
#
# Statuses: open | triaged | in-progress | resolved | accepted
# Quadrants: deliberate-prudent | deliberate-reckless | inadvertent-prudent | inadvertent-reckless

summary:
  total: 42
  high: 8
  medium: 19
  low: 15
  open: 34
  accepted: 5
  in_progress: 2
  resolved: 1

items:
  - id: debt-001
    fingerprint: a1b2c3d4
    category: hotspot
    severity: high
    location: src/api/views.py
    title: "High-churn, high-complexity API view module"
    detail: "38 commits in 6 months, cyclomatic complexity 24. Handles 12 endpoints
             with mixed concerns (auth, validation, serialization, business logic)."
    consequences: "Every API change requires understanding 847 lines of interleaved
                   concerns. Bug rate in this file is 3x the project average."
    causes: evolution
    metrics:
      churn: 38
      complexity: 24
      lines: 847
    suggestion: "Split by resource: extract UserViews, OrderViews, ProductViews
                 into separate modules. Extract validation into validators.py."
    effort: medium
    status: open
    first_detected: 2026-04-06
    last_detected: 2026-04-06
    change_id:

  - id: debt-002
    fingerprint: e5f6a7b8
    category: structural_bloat
    severity: high
    location: src/models/order.py
    title: "God class: Order model with 34 methods"
    detail: "Order class has 34 methods spanning validation, pricing, fulfillment,
             notification, and reporting. 680 lines."
    consequences: "Cannot test pricing logic without instantiating the full Order.
                   Fulfillment changes risk breaking notification logic."
    causes: evolution
    metrics:
      methods: 34
      lines: 680
    suggestion: "Extract concerns: OrderPricing, OrderFulfillment, OrderNotifier.
                 Keep Order as the aggregate root with delegated behavior."
    effort: large
    status: open
    first_detected: 2026-04-06
    last_detected: 2026-04-06
    change_id:

  - id: debt-003
    fingerprint: c9d0e1f2
    category: data_structure
    severity: medium
    location: src/types/config.ts
    title: "AppConfig interface with 28 optional fields"
    detail: "28 fields, 22 optional. Used in 3 different contexts (server, client,
             CLI) with different required subsets."
    consequences: "Every consumer must null-check fields that are always present in
                   its context. TypeScript can't catch missing required fields."
    causes: evolution
    metrics:
      fields: 28
      optional_ratio: 0.79
    suggestion: "Split into ServerConfig, ClientConfig, CLIConfig with a shared
                 BaseConfig. Each context gets only the fields it uses."
    effort: medium
    status: accepted                          # matched by exception
    quadrant: deliberate-prudent
    exception_reason: "Splitting would break plugin API. Revisit in Q4."
    first_detected: 2026-04-06
    last_detected: 2026-04-06
    change_id:

  - id: debt-004
    fingerprint: a3b4c5d6
    category: broken_promise
    severity: high
    location: src/auth/session.py:42
    title: "TODO: replace with proper session store"
    detail: "Comment added 2024-01-15 (>1 year old). Session data stored in signed
             cookies — works but doesn't support server-side invalidation."
    consequences: "Cannot revoke sessions on password change or account compromise.
                   Security incident response requires waiting for cookie expiry."
    causes: deadline
    metrics:
      age_days: 450
    suggestion: "Migrate to Redis-backed sessions (infrastructure already available
                 per context.yml)."
    effort: medium
    status: open
    first_detected: 2026-04-06
    last_detected: 2026-04-06
    change_id:

  - id: debt-005
    fingerprint: e7f8a9b0
    category: circular_dependency
    severity: medium
    location: src/orders/ ↔ src/inventory/
    title: "Circular import between orders and inventory"
    detail: "orders/service.py imports inventory/check.py, inventory/reserve.py
             imports orders/models.py. Coupled through model references."
    consequences: "Cannot deploy or test orders without inventory, and vice versa.
                   Import order is fragile — adding a new import can break both."
    causes: evolution
    metrics:
      cycle_length: 2
    suggestion: "Extract shared types into a common module, or use dependency
                 injection / events to decouple."
    effort: medium
    status: open
    first_detected: 2026-04-06
    last_detected: 2026-04-06
    change_id:
```

**Register rules:**
- Each item has a unique `id` (debt-NNN, monotonically increasing) and a stable `fingerprint` for dedup
- `status` tracks lifecycle: `open` → `triaged` → `in-progress` → `resolved` (or `accepted` via exception)
- `first_detected` and `last_detected` track how long debt has been known — debt that persists across many scans is aging and may need escalation
- Items matched by an exception get `status: accepted` with `quadrant` and `exception_reason` copied from the exception file
- Items whose exception has expired revert to `status: open` with a note in `detail`: "Exception expired YYYY-MM-DD — re-evaluate"
- `consequences` should articulate what happens if this debt is NOT addressed — this forces the scanner (and the user) to think about real impact, not just code aesthetics
- `causes` classifies how the debt was introduced: `evolution` (grew incrementally), `deadline` (time pressure), `knowledge` (didn't know better at the time), `dependency` (forced by external constraint)
- `change_id` links to the grimoire change created to address it (populated when the user approves a refactoring)
- `effort` is a rough estimate: `small` (<1 hour), `medium` (1-4 hours), `large` (>4 hours / multiple sessions)
- On refresh: match by fingerprint, preserve status and first_detected for known items, update last_detected and metrics, add new items, mark items no longer detected as `resolved` automatically
- Sort by severity (high first), then by hotspot score within severity

### 5. Prioritize and Present

Present findings to the user grouped by severity, with recommended action order. Only show items with `status: open` — accepted items are tracked but not flagged.

**Prioritization heuristic (automated):**
1. **High-severity hotspots first** — highest ROI, every future change benefits
2. **High-severity structural bloat** — simplification unlocks everything else
3. **High-severity data structure complexity** — foundational, affects many layers
4. **Circular dependencies** — blocks clean architecture
5. **Everything else by severity**

**Present in batches** (same pattern as grimoire-audit — don't dump):
- Show top 5 items first with their category, location, suggestion, and consequences
- For each item, ask the user to choose one of:
  - **fix** — create a grimoire change to address it (status → `in-progress`)
  - **defer** — acknowledge but not now (status → `triaged`, revisit next scan)
  - **accept** — the cost of fixing exceeds the benefit (status → `accepted`)

**When the user chooses "accept"**, collect exception details interactively:
1. Ask for a **reason** (required) — why is this debt acceptable? What's the trade-off?
2. Ask for the **Fowler quadrant** (required) — present the four options:
   - `deliberate-prudent`: "We know, and it's the right trade-off for now"
   - `deliberate-reckless`: "We know, and we're cutting corners"
   - `inadvertent-prudent`: "We didn't know then, and fixing isn't worth it now"
   - `inadvertent-reckless`: "We didn't know, and the cost to fix is too high right now"
3. Ask for an **expiry date** (optional) — when should this be re-evaluated? If set, the scanner re-flags after this date.
4. Write the exception to `.grimoire/debt-exceptions.yml` automatically
5. Update the register item: `status: accepted`, `quadrant`, `exception_reason`

**If the user chooses "accept" with quadrant `deliberate-reckless`**, flag it gently: "Noted. Just a heads-up — too many deliberate-reckless exceptions may indicate systemic time pressure. You might want to discuss capacity with the team." Don't block, just inform.

After the first batch, ask if the user wants to see more or start working on the approved items.

**Present a summary of existing exceptions** if any exist:
- "You have 5 accepted items in debt-exceptions.yml. 1 expires next month."
- This keeps the team aware of debt they've acknowledged but not resolved.

**When presenting, frame simplification opportunities concretely:**
- "This 847-line file could become 3 files of ~250 lines each"
- "This 34-method class has 5 distinct responsibilities — extracting them would make each class testable independently"
- "This 28-field config type is used in 3 contexts — splitting it eliminates 22 optional fields and makes each usage self-documenting"
- "Flattening this 4-level nested structure into 2 normalized types would eliminate the deep property chains throughout the codebase"

### 6. Create Grimoire Changes

For each item the user approves to fix:

1. Create a grimoire change: `refactor-<debt-id>` (e.g., `refactor-debt-001`)
2. Update the debt register item: set `status: in-progress`, set `change_id`
3. Draft the change using the standard grimoire format:
   - **Manifest** with the refactoring rationale (what the debt is, why it matters, what "done" looks like)
   - **Feature files** if the refactoring changes behavior boundaries (rare for pure refactors, but splitting a module may change its public API)
   - **Decision record** if the refactoring involves an architectural choice (e.g., "extract event system to decouple orders and inventory")
4. Hand off to `/grimoire:plan` for task generation, then `/grimoire:apply` for implementation

**Refactoring-specific guidance for the plan/apply stages:**
- **All existing tests must keep passing.** A refactoring that breaks tests is not a refactoring.
- **Prefer incremental moves over big-bang rewrites.** Move one function at a time, run tests after each move.
- **Add tests before refactoring if test debt is part of the item.** You need a safety net before restructuring.
- **Update imports incrementally.** When moving code to a new module, re-export from the old location first, then update consumers, then remove the re-export.
- **Update area docs after refactoring.** File paths and reusable code locations will have changed.

### 7. Track Progress

After refactoring is complete (grimoire apply finishes):
1. Update the debt register item: set `status: resolved`
2. Update metrics if a re-scan shows improvement
3. Present a before/after summary:
   - Lines of code: before → after
   - Complexity: before → after
   - Number of files/classes/functions: before → after
   - Test coverage: before → after (if measurable)

### 8. Ongoing Maintenance

The debt register is a living document. Recommend:
- **Monthly re-scan** to catch new debt and verify resolved items stay resolved
- **Per-sprint planning** — pick 1-2 high-severity items each sprint alongside feature work
- **Gate new debt** — the existing grimoire check pipeline (complexity, duplication, best practices) catches debt at commit time. The refactor skill handles accumulated debt.

## Integration with Other Skills

- **grimoire-health** — the health score reflects some debt dimensions (coverage, complexity, duplicates). Refactoring should improve health scores.
- **grimoire-audit** — audit finds undocumented features/decisions. Refactor finds code quality issues. They're complementary — run audit first to understand what the code does, then refactor to improve how it does it.
- **grimoire-discover** — area docs provide context for refactoring. After refactoring, run discover to update docs.
- **grimoire-review** — the senior engineer persona already checks for simplicity and reuse. Refactor findings can inform review criteria.
- **grimoire-check** — the commit-time checks prevent new debt. Refactor addresses existing debt.

## Important
- **Don't boil the ocean.** Tech debt reduction is incremental. Pick the highest-impact items and make measurable progress. A codebase with zero debt is not the goal — a codebase where debt doesn't slow you down is.
- **Respect wont-fix.** Some debt is cheaper to live with than to fix. A 500-line file that changes once a year is not worth splitting. Acknowledge this and move on.
- **Simplification is the primary goal.** Every refactoring should make the codebase smaller, simpler, or more focused. If a refactoring adds complexity (more files, more abstractions, more indirection) without reducing something else, question whether it's actually an improvement.
- **Measure before and after.** A refactoring without measurable improvement is just code churn. Track lines, complexity, coverage, and file count.
- **Existing tests are your safety net.** Never refactor without tests. If tests don't exist, write them first (that's test debt — address it before or alongside the structural refactoring).
- **Present findings collaboratively** — same interview pattern as grimoire-audit. Batches of 3-5, let the user drive priority. Don't dump a 50-item list.
