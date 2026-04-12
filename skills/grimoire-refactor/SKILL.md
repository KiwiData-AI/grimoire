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

## Routing
- Behavior change needed (not just code quality) → `grimoire-draft`
- Removing a feature → `grimoire-remove`
- Fixing a bug → `grimoire-bug`
- Documenting existing code → `grimoire-discover`

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

**Scanner behavior:** For each finding, compute fingerprint → check exceptions (by id, then pattern+category) → check if expired → check existing register by fingerprint → add/update item.

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

Run applicable scans from the categories in `../references/refactor-scan-categories.md`. Each category has specific signals, thresholds, severity levels, and scan commands referencing `config.tools.*` entries.

**Key categories** (details in reference):
- **Hotspots** (churn x complexity) — highest ROI, uses `git log` + `config.tools.complexity`
- **Structural bloat** — oversized files/functions/classes
- **Data structure complexity** — over-engineered models, deep nesting
- **Circular dependencies** — tight coupling between modules
- **Dependency staleness** — uses `config.tools.dep_audit` or package manager outdated commands
- **Broken promises** — aged TODO/FIXME/HACK comments via `grep` + `git blame`
- **Duplication** — uses `.snapshot.json` duplicates or `config.tools.duplicates`
- **Dead code** — uses `config.tools.dead_code` or `codebase-memory-mcp` graph queries
- **Test debt** — high complexity + low coverage

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

See `../references/refactor-register-format.md` for the full field specification and example items.

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

## Done
When debt items are triaged (fixed, deferred, or accepted) and grimoire changes are created for approved fixes, the workflow is complete. Each approved fix flows through the standard pipeline: `grimoire-plan` → `grimoire-apply`.
