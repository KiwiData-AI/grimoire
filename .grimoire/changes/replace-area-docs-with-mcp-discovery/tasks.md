# Tasks: replace-area-docs-with-mcp-discovery

> **Change**: Make codebase-memory-mcp a hard requirement; replace area docs with per-area conventions files; morph `grimoire map` into drift detection
> **Features**: features/cli/map.feature, features/cli/init.feature, features/onboarding/run-discover.feature, features/onboarding/run-audit.feature
> **Decisions**: decisions/0030-mcp-required-conventions-replace-area-docs.md
> **Test command**: `npm test`
> **Status**: 5/29 tasks complete

## Reuse

- `runJscpd()` at `src/core/map.ts:364` — keep as-is for `--duplicates`
- `loadConfig()` from `src/utils/config.ts` — use to detect MCP flag
- `findProjectRoot()` from `src/utils/paths.js` — unchanged
- `chalk` already imported in `src/core/map.ts`
- vitest mock patterns from `src/core/map.test.ts` — follow same structure

---

## 1. CLI — grimoire map rewrite

<!-- context:
  src/core/map.ts
  src/core/map.test.ts
  src/commands/map.ts
  src/utils/config.ts
  src/utils/paths.ts
  .grimoire/changes/replace-area-docs-with-mcp-discovery/features/cli/map.feature
-->

These tasks replace the snapshot-generation logic with drift-detection logic. The `--duplicates` path (jscpd) is kept without change. Tests run first (red), then implementation.

### 1.1 — Tests: MCP required guard
- [x] Edit `src/core/map.test.ts`: add describe block `"runMap — MCP guard"`
  - Test: `"throws McpRequiredError when codebase_memory_mcp not configured"`
    - Mock `loadConfig` to return `{ project: { integrations: {} } }`
    - Mock `readdir` to return conventions files
    - Spy on `console.error`
    - Call `await expect(runMap({ duplicates: false })).rejects.toThrow("McpRequiredError")`
    - Assert `console.error` was called containing `"codebase-memory-mcp"` and `"required"`
    - (The CLI command handler converts `McpRequiredError` to `process.exit(1)` — tested separately in `src/commands/map.test.ts` if one exists, otherwise noted as manual verification)
  - **Satisfies**: `map.feature` → "Map refuses to run when MCP not configured"

### 1.2 — Tests: drift detection
- [x] Edit `src/core/map.test.ts`: add describe block `"runMap — drift detection"`
  - Test: `"reports drift when a conventions path does not exist in the codebase"`
    - Mock `loadConfig` → MCP configured (`codebase_memory_mcp: true`)
    - Mock `readdir` on `.grimoire/docs/conventions/` → `["api.md"]`
    - Mock `readFile("…/api.md")` → markdown content: `"New views go in \`src/api/views/\`"`
    - Mock `access(join(root, "src/api/views/"))` → throws ENOENT
    - Spy on `console.log`
    - Call `runMap({ duplicates: false })`
    - Assert output contains `"src/api/views/"` and the word `"drift"` or `"stale"`
    - Assert output contains `"api.md"`
  - Test: `"reports clean when all conventions paths exist"`
    - Same setup but `access` succeeds for all paths
    - Assert output contains `"No drift detected"` (or similar)
    - Assert exit code 0 (process.exit not called with 1)
  - Test: `"drift report does not contain the home directory path"`
    - Mock root as `/home/testuser/project`
    - Drift found in a conventions file
    - Assert `console.log` calls contain no `/home/testuser`
  - Test: `"prints suggestion when conventions directory is empty"`
    - Mock `readdir` on `.grimoire/docs/conventions/` → `[]`
    - Assert output suggests running `/grimoire:discover`
  - Test: `"produces zero drift items for a conventions file with no path references"`
    - Mock `readFile` → content with only headings and prose (no backtick paths)
    - Assert `runMap` completes without error and outputs "No drift detected"
  - **Satisfies**: `map.feature` → "Detect conventions drift", "Drift report shows specific mismatches", "Clean project reports no drift", "Drift report does not leak absolute paths"

### 1.3 — Tests: --duplicates no-regression
- [x] Edit `src/core/map.test.ts`: add test `"--duplicates still invokes jscpd when MCP is configured"`
    - Mock `loadConfig` → MCP configured
    - Mock readdir to return no conventions files
    - Mock jscpd path (`execFileAsync`)
    - Call `runMap({ duplicates: true })`
    - Assert jscpd was invoked
  - **Satisfies**: `map.feature` → "Detect duplicate code" (no regression)

### 1.4 — Implementation: rewrite `src/core/map.ts`
- [x] Replace all of `src/core/map.ts` with a new implementation:
  - **Remove**: `MapOptions` (replace with `{ duplicates: boolean }`), `MapSnapshot`, `DirectoryInfo`, `KeyFileInfo`, `generateMap()`, `scanDirectory()`, `loadExistingAreas()`, `parseIgnoreFile()`, `parseKeyFilesConfig()`, `loadConfigFile()`
  - **Keep**: `CloneInfo`, `DuplicateReport`, `runJscpd()` (no change)
  - **Add** `interface MapOptions { duplicates: boolean }`
  - **Add** `interface DriftItem { conventionsFile: string; path: string; context: string }`
  - **Add** `class McpRequiredError extends Error {}` (export so CLI handler can catch by type)
  - **Add** `async function requireMcpConfigured(root: string): Promise<void>`:
    - `import { loadConfig } from "../utils/config.js"`
    - Loads config via `loadConfig(root).catch(() => null)`
    - If `!config?.project.integrations?.codebase_memory_mcp`:
      - `console.error(chalk.red("Error: codebase-memory-mcp is required for grimoire map."))`
      - `console.error("Install codebase-memory-mcp and run grimoire init to register it.")`
      - `throw new McpRequiredError("codebase-memory-mcp not configured")`
  - **Add** `function extractPathRules(content: string, filename: string): DriftItem[]`:
    - Split content by newlines
    - Only scan lines under a "## File Placement" or "## Patterns" section header (track current section; skip lines not under those headers)
    - For each qualifying line: find backtick-wrapped tokens matching `([a-z][^` + '`' + `]+\/)` (path ending in `/`)
    - Skip tokens containing `(`, `;`, `node_modules`, `dist`, `build`, `.git` (common tool dirs, not placement rules)
    - Return `{ conventionsFile: filename, path: match[1], context: line.trim() }`
  - **Add** `async function detectConventionsDrift(root: string): Promise<DriftItem[]>`:
    - `import { access, readFile, readdir } from "node:fs/promises"`
    - Read `.grimoire/docs/conventions/` directory; if not found or empty, print chalk.dim suggestion to run `/grimoire:discover` and return `[]`
    - For each `*.md` file: read content, call `extractPathRules()`, for each rule:
      - Validate path is within root: `const resolved = resolve(join(root, rule.path)); if (!resolved.startsWith(root + "/")) continue;`
      - Try `access(resolved)` — on ENOENT push to drift list
    - Return all drift items
  - **Add** `export async function runMap(options: MapOptions): Promise<void>`:
    - `const root = await findProjectRoot()`
    - `await requireMcpConfigured(root)` — throws `McpRequiredError` if not configured
    - `const drift = await detectConventionsDrift(root)`
    - If drift.length > 0: print chalk.yellow "Drift detected:", then per item: `  <conventionsFile>: <context> — path not found: <path>` (all paths via `relative(root, ...)`)
    - If drift.length === 0: print chalk.green "No drift detected. Conventions files match the codebase."
    - Print chalk.dim "For semantic drift (naming, patterns), run /grimoire:discover in an agent session."
    - If `options.duplicates`: call `runJscpd(root, new Set())` (load dupignore from config as before via a simplified `loadDupIgnore(root)` helper that reads `.grimoire/dupignore` or returns empty Set)
    - Do NOT write `.snapshot.json`
  - **In `src/commands/map.ts` action handler**: wrap `runMap(...)` call in `try/catch (e) { if (e instanceof McpRequiredError) process.exit(1); throw e; }` — keeps `process.exit` out of core logic and in the CLI boundary
  - **Export rename**: function is now `runMap` (not `generateMap`); `McpRequiredError` also exported
  - Import cleanup: remove `parseIgnoreFile`, `parseKeyFilesConfig`; keep `chalk`, `findProjectRoot`, `join`, `relative`, `resolve`, `readFile`, `readdir`, `access`, `promisify`, `execFile`

### 1.5 — Implementation: update `src/commands/map.ts`
- [x] Rewrite `src/commands/map.ts`:
  - Remove `--json`, `--refresh`, `--depth` options
  - Keep only `--duplicates`
  - Change import from `generateMap` to `runMap`
  - Change action to call `runMap({ duplicates: options.duplicates ?? false })`

<!-- SESSION: Section 1 complete. runMap/McpRequiredError exported from src/core/map.ts. src/commands/map.ts uses try/catch for McpRequiredError→process.exit. All map tests pass. -->

---

## 2. CLI — init next-steps update

<!-- context:
  src/core/init.ts
  src/core/init.test.ts
  .grimoire/changes/replace-area-docs-with-mcp-discovery/features/cli/init.feature
-->

### 2.1 — Tests: next-steps output
- [x] Read `src/core/init.test.ts` to understand current test structure, then add to it:
  - Test: `"prints discover (not map) as next step for existing projects"`
    - Mock `detectTools()` to return detection with `language: "typescript"` (signals existing project)
    - Mock all file operations (mkdir, writeFile, copyFile, etc.)
    - Call `initProject(".", { skipAgents: true, skipSkills: true, noDetect: false, agents: [], full: false })`
    - Assert `console.log` calls contain `"/grimoire:discover"` or `"discover"`
    - Assert none contain `"grimoire map"` 
    - Assert one contains `"codebase-memory-mcp"` (install note)
  - Test: `"prints draft (not discover) as next step for greenfield projects"`
    - Mock `detectTools()` to return empty detection (no language detected)
    - Same file operation mocks
    - Call `initProject(".", { ... })`
    - Assert `console.log` calls contain `"/grimoire:draft"` or `"draft"`
    - Assert none contain `"discover"` or `"grimoire map"`
    - Assert none contain `"codebase-memory-mcp"` in the next-steps block (MCP note is for existing projects only)
  - **Satisfies**: `init.feature` → "Init prints a two-step onboarding flow for existing projects", "Init prints a one-step onboarding flow for greenfield projects"

### 2.2 — Implementation: update `src/core/init.ts` next-steps
- [x] Edit `src/core/init.ts` to change next-steps output (around lines 218-229):
  - After `console.log("Next steps:")`, add detection-based branching:
    - If existing project (detection found a language, i.e., `detection?.language`):
      ```
      Next steps:
        1. Install codebase-memory-mcp (required): [install link]
        2. Run /grimoire:discover to generate conventions files and data schema
        3. Run /grimoire:audit to document existing features and decisions
      ```
    - If greenfield:
      ```
      Next steps:
        Run /grimoire:draft to write your first feature spec
      ```
  - Remove the existing "Edit .grimoire/docs/context.yml..." next-step line (it still gets created; just remove from next-steps)
  - Keep the `grimoire configure` hint for non-full mode
  - Keep `printIntegrationInstructions()` call
  - Thread the detection result instead of calling `detectTools(root)` twice:
    - `buildDetectedConfig(root, integrationFlags)` currently returns `GrimoireConfig` — change its return type to `{ config: GrimoireConfig; detection: Detection }` and have callers destructure it
    - Update the call sites in `initProject()` to use `const { config, detection } = await buildDetectedConfig(...)` 
    - Pass `detection` to the next-steps block directly — no second `detectTools()` call
    - The greenfield check: `const isExistingProject = !!detection?.language`
    - Greenfield next-steps block must NOT print the codebase-memory-mcp install note (consistent with updated init.feature scenario)

---

<!-- SESSION: Section 2 complete. buildDetectedConfig() now returns {config, detection}. initProject() uses detection to choose between existing-project (discover+audit path) and greenfield (draft path) next-steps. Tests pass. -->

## 3. Skills rewrite

<!-- context:
  .claude/skills/grimoire-discover/SKILL.md
  .claude/skills/grimoire-audit/SKILL.md
  .claude/skills/grimoire-plan/SKILL.md
  .claude/skills/grimoire-apply/SKILL.md
  .claude/skills/grimoire-precommit-review/SKILL.md
  .grimoire/changes/replace-area-docs-with-mcp-discovery/features/onboarding/run-discover.feature
  .grimoire/changes/replace-area-docs-with-mcp-discovery/features/onboarding/run-audit.feature
-->

Skills are LLM instruction files — no unit tests apply. Each task is a targeted edit to the SKILL.md. Implement in order (discover first since audit and plan reference its output).

### 3.1 — grimoire-discover: MCP required guard and conventions output

- [x] Edit `.claude/skills/grimoire-discover/SKILL.md`:

  **Frontmatter description**: Change to "Generate per-area conventions files and data schema using codebase-memory-mcp. Requires MCP to be installed."

  **Triggers**: Add "Loose match: 'conventions'" to existing list

  **Prerequisites** section — replace entirely with:
  ```
  **MCP required:** `codebase-memory-mcp` must be installed and indexed. If it is not available, stop immediately and tell the user:
  - "codebase-memory-mcp is required for grimoire-discover."
  - "Install it from: [MCP installation instructions]"
  - "After installing, tell your agent to index this project, then re-run /grimoire:discover."

  Do not proceed without MCP. Do not fall back to reading source files for symbol discovery.
  ```
  Remove the entire "Structural snapshot" prerequisite block (no more `grimoire map` first).

  **What It Produces** section — replace area docs list with:
  ```
  `.grimoire/docs/conventions/` with:
  - **Per-area conventions files** — one markdown file per area (e.g., `api.md`, `models.md`), each covering:
    - File placement rules (where new code of this type goes)
    - Naming conventions (with examples)
    - Pattern guidance (what exemplar files to follow)
    - A "Last updated" date
  - **NOT included**: reusable utility tables, full API inventories, call graphs — those are answered on demand by MCP queries

  `.grimoire/docs/data/schema.yml` (if a data layer exists)
  `.grimoire/docs/context.yml` (deployment and infrastructure context)
  `.grimoire/docs/components.md` (if a UI component library is present)
  ```

  **Workflow Step 1** — replace with:
  ```
  ### 1. Archive Legacy Area Docs
  Before generating anything, check whether `.grimoire/docs/` contains legacy area doc files (any `.md` files directly in `.grimoire/docs/`, NOT in the `conventions/` subdirectory, NOT `context.yml`, NOT `components.md`).

  If legacy docs exist:
  1. Create `.grimoire/archive/docs/YYYY-MM-DD/` (today's date)
  2. Move each legacy `.md` file there (including `index.yml` if present)
  3. Print a note listing each archived file: "Archived legacy doc: .grimoire/docs/api.md → .grimoire/archive/docs/2026-05-21/api.md"

  Then proceed. If no legacy docs exist, skip silently.
  ```

  **Workflow Step 2** — rename from "Determine Scope" — keep mostly as-is but remove "Check `.grimoire/docs/index.yml` if it exists" line (no more index.yml)

  **Workflow Step 3** (was "Analyze Each Area") — remove the "From the snapshot (already known)" bullet. Change opening to:
  ```
  For each area identified by MCP's `get_architecture` output:

  **From `codebase-memory-mcp` graph (required):**
  ```
  (Remove "From reading the code (your job — or to supplement the graph)" section — MCP is the primary source now)

  **Workflow Step 4** (was "Generate Area Docs") — replace with "Generate Conventions Files":
  ```
  ### 4. Generate Conventions Files
  For each significant area, create `.grimoire/docs/conventions/<area>.md`.

  **Conventions file format:**
  ```markdown
  # <Area Name> Conventions
  > Last updated: YYYY-MM-DD

  ## File Placement
  - New <type> → `<path/to/directory/>`
  - New <type> → `<path/to/other/>`

  ## Naming
  - <naming convention with example from codebase>

  ## Patterns
  - Follow `<path/to/exemplar/file.ts>` for <what it exemplifies>
  - <structural pattern with example file reference>
  ```

  **Rules:**
  - Conventions files document PLACEMENT, NAMING, and PATTERNS only
  - Do NOT include reusable utility tables (MCP answers those on demand)
  - Do NOT include full file lists or API inventories
  - Reference exemplar files by path; do NOT copy code
  - One file per logical area; keep files under 50 lines
  ```

  **Remove Step 7** (Generate Index) entirely — no more `index.yml`

  **Workflow Step 5** (Data Schema) — keep as-is

  **Workflow Step 5.5** (Component Inventory) — keep as-is

  **Workflow Step 6** (Project Context) — keep as-is; renumber remaining steps

  **New Step 7** (was Step 8): Update "Present Summary" to mention conventions files not area docs

  **Freshness Tracking** section — simplify: remove `index.yml` tracking guidance; keep only the per-file `> Last updated:` rule

  **Config Files** section — remove entirely (mapignore, mapkeys no longer relevant)

  **Integration with Other Skills** section — replace with:
  ```
  ## Integration with Other Skills

  - The **plan** skill reads `.grimoire/docs/conventions/<area>.md` for placement/naming guidance and queries MCP directly for symbol/utility lookup
  - The **audit** skill can trigger a discover pass during onboarding; it also uses conventions files for drift detection
  - The **apply** skill's context blocks reference conventions files, not area docs
  - Run `/grimoire:audit` with scope "conventions" to detect drift after the codebase evolves significantly
  ```

  **Important** section — replace "Start from the snapshot" and "Prefer graph queries over file reads" bullets with:
  ```
  - **MCP is required and is the only discovery path.** No fallback to file reads for symbol discovery.
  - **Conventions files are small by design.** If a conventions file exceeds ~50 lines, you're putting too much in it — move symbol/API detail to MCP queries.
  - **Archive, don't delete.** Legacy area docs go to `.grimoire/archive/docs/YYYY-MM-DD/` on first run.
  ```

  **Satisfies**: `run-discover.feature` → all 6 scenarios

### 3.2 — grimoire-audit: conventions drift detection

- [x] Edit `.claude/skills/grimoire-audit/SKILL.md`:

  **Step 1 (Determine Audit Scope)** — add "Conventions" as a third scope option:
  ```
  - **Features** — find behavioral functionality that has no `.feature` file
  - **Decisions** — find implicit architecture decisions that have no ADR
  - **Conventions** — find conventions files in `.grimoire/docs/conventions/` whose placement/naming rules no longer match the codebase
  - **Both** / **All** — full audit (default: features + decisions + conventions)
  ```

  **Add new Step 3.5 — Conventions Drift Detection** (insert between existing Step 3 and Step 4):
  ```
  ### 3.5. Conventions Drift Detection
  Read each file in `.grimoire/docs/conventions/`. For each file:
  1. Use MCP `get_architecture` or `search_graph` to query the current code structure for the relevant area
  2. Compare the conventions file's placement rules, naming rules, and patterns against what MCP reports the codebase actually does
  3. Flag any conventions rule that no longer matches:
     - "api.md says new views go in `src/api/views/` but MCP shows views now in `src/api/handlers/`"
     - "models.md says models are prefixed with `I` but no `I`-prefixed models found in MCP graph"

  Present drifted conventions to the user with the same batched interview approach:
  > "api.md states that new views go in `src/api/views/`, but the codebase now places them in `src/api/handlers/`. Options:
  > - **refresh** — update the conventions file to match current code (I'll open it for editing with MCP-sourced state)
  > - **accept-as-is** — the conventions file is intentionally ahead of the code
  > - **skip** — leave for now"

  Skip this step when the user's scope answer was "features only" or "decisions only".
  ```

  **Step 4 (Interview the User)** — add to label guidance:
  ```
  Clearly label each batch item as one of: "undocumented feature", "undocumented decision", or "drifted convention"
  ```

  **Step 7 (Prioritize)** — add conventions count:
  ```
  - How many conventions files drifted vs. up-to-date
  ```

  **Satisfies**: `run-audit.feature` → "Audit detects drifted conventions", "Audit includes conventions drift in its scope options", "Audit batches conventions drift with other findings", "Audit lets the user narrow scope during the intake"

### 3.3 — grimoire-plan: remove area-doc references, add MCP-first lookup

- [x] Edit `.claude/skills/grimoire-plan/SKILL.md`:

  **Section "Read from grimoire docs"** — replace the area docs bullet and the "Read specific source files only when" block:

  Replace:
  ```
  **`.grimoire/docs/<area>.md`** for each area the change touches — these contain: key files with responsibilities, reusable utilities...
  ```
  With:
  ```
  **`.grimoire/docs/conventions/<area>.md`** for each area the change touches — these contain: file placement rules, naming conventions, and pattern guidance. Read these for placement/naming decisions.
  ```

  Replace the snapshot bullet:
  ```
  **`.grimoire/docs/.snapshot.json`** `duplicates` section if present — existing clones in areas you're touching, so tasks consolidate rather than add more.
  ```
  With nothing (remove entirely — snapshot is gone).

  Replace the "Read specific source files only when" block:
  ```
  **Read specific source files only when:**
  - Conventions files don't exist yet → tell the user to run `/grimoire:discover` first
  - Conventions files exist but you need to verify a specific implementation detail (e.g., exact function signature) → use `get_code_snippet` from codebase-memory-mcp first; fall back to Read only if MCP unavailable
  - You need to read existing step definitions to understand the test setup
  ```

  **Section "Existing code to reuse"** — replace area-doc Reusable Code table reference:
  Replace:
  ```
  - If `.grimoire/docs/` has area docs, check the Reusable Code tables for utilities that apply to this change
  - If the snapshot has duplicate data, check whether the area you're touching already has clones — tasks should consolidate rather than add more
  ```
  With:
  ```
  - Use `search_graph(name_pattern=...)` from codebase-memory-mcp to find existing utilities before writing new ones
  - Use `get_code_snippet(qualified_name=...)` to read the implementation of a candidate utility before deciding to reuse or write new
  - Conventions files document placement/naming — use them for "where does this code go?" not "what utilities exist?"
  ```

  **Operating Rule §1 (Verify, don't delegate)** — add to the Tools list:
  ```
  Tools: codebase-memory-mcp (`search_graph`, `trace_path`, `get_code_snippet`), `.grimoire/docs/conventions/<area>.md` for placement/naming, `Grep`, neighbor files.
  ```
  (Replace existing reference to `.grimoire/docs/<area>.md` reusable-code tables)

  **Satisfies**: ADR 0030 decision — plan uses MCP directly and conventions files for placement/naming

### 3.4 — grimoire-apply: update context block references

- [x] Edit `.claude/skills/grimoire-apply/SKILL.md`:

  **Step 3 (Gather Project Context)** / **Step 4 (Load Context)** — replace area doc references:

  In the "Load Context" section where it mentions relevant docs to load, replace:
  ```
  Relevant `.grimoire/docs/<area>.md` for directories touched by the diff
  ```
  With:
  ```
  Relevant `.grimoire/docs/conventions/<area>.md` for directories touched by the diff (placement/naming guidance)
  ```

  (Note: there is no explicit "Step 3 Gather Project Context" in grimoire-apply — the relevant location is in the loading order list. Find the line referencing `.grimoire/docs/<area>.md` and update it.)

  **Satisfies**: manifest → "grimoire-apply context blocks reference conventions files, not area docs"

### 3.5 — grimoire-precommit-review: remove auto-refresh, update doc references

- [x] Edit `.claude/skills/grimoire-precommit-review/SKILL.md`:

  **Step 3 (Gather Project Context)** — replace area doc reference:
  Replace:
  ```
  - Relevant `.grimoire/docs/<area>.md` for directories touched by the diff
  ```
  With:
  ```
  - Relevant `.grimoire/docs/conventions/<area>.md` for directories touched by the diff (placement/naming conventions)
  ```

  Confirm there is no "auto-refresh area docs" logic currently in this file (it was described in the session as "added this session, now obsolete"). If any reference to triggering `grimoire-discover` for stale docs is found, remove it. If not found, skip silently.

  **Satisfies**: manifest → "grimoire-precommit-review removes auto-refresh-of-area-docs logic; reads conventions files"

---

## 4. AGENTS.md onboarding update

<!-- context:
  AGENTS.md
  .grimoire/changes/replace-area-docs-with-mcp-discovery/features/cli/init.feature
-->

### 4.1 — Update existing-project onboarding decision tree
- [x] Edit `AGENTS.md` lines 95-101: change the "Setting up grimoire on an existing project" branch from 5 steps to 3 steps:

  Replace:
  ```
  ├─ "Setting up grimoire on an existing project"
  │  1. `grimoire init` → creates .grimoire/ directory and config
  │  2. `grimoire map` → scans codebase structure into .snapshot.json
  │  3. `/grimoire:discover` → generates area docs, data schema, project context
  │  4. `/grimoire:audit` → discovers undocumented features and decisions
  │  5. Start working: `/grimoire:draft` for new changes, `/grimoire:bug` for fixes
  ```
  With:
  ```
  ├─ "Setting up grimoire on an existing project"
  │  1. `grimoire init` → creates .grimoire/ directory and config
  │  2. `/grimoire:discover` → generates conventions files, data schema, project context (requires codebase-memory-mcp)
  │  3. `/grimoire:audit` → discovers undocumented features and decisions
  │  4. Start working: `/grimoire:draft` for new changes, `/grimoire:bug` for fixes
  ```

  **Satisfies**: `init.feature` → "Init prints a two-step onboarding flow for existing projects", manifest → "AGENTS.md onboarding decision tree removes grimoire map as prerequisite"

<!-- SESSION: Sections 3+4 complete. grimoire-discover rewritten for conventions files + MCP required. grimoire-audit extended with drift detection scope. grimoire-plan updated to reference conventions files + MCP. grimoire-apply and grimoire-precommit-review updated. AGENTS.md onboarding now 4 steps (no grimoire map). -->

---

## 5. ADR acceptance and feature baseline sync

<!-- context:
  .grimoire/changes/replace-area-docs-with-mcp-discovery/decisions/0030-mcp-required-conventions-replace-area-docs.md
  .grimoire/decisions/
  features/
-->

### 5.1 — Update manifest status
- [x] Edit `.grimoire/changes/replace-area-docs-with-mcp-discovery/manifest.md`: change `status: draft` → `status: implementing`

### 5.2 — ADR confirmation criteria check (from ADR 0030)
The ADR's confirmation section requires manual verification after implementation:
> "After implementation: run discover on a real project and verify (1) no area docs remain in `.grimoire/docs/`, (2) plan generates tasks with correct file paths sourced from MCP queries, (3) `grimoire map` correctly flags a deliberately stale conventions rule."

- [x] Add a note to `tasks.md` after this task that the ADR confirmation must be done manually on a real project before archiving the change. Do not block the task list on it — record as a follow-up.

### 5.3 — Run test suite
- [x] Run `npm test` — all existing tests must pass; the new tests from sections 1 and 2 must pass
- [x] Fix any failures before marking this section complete

### 5.4 — Feature baseline sync (do last, at apply-finalize time)
Copy proposed feature files to the baseline:
- [x] Copy `features/cli/map.feature` from the change into `features/cli/map.feature`
- [x] Copy `features/cli/init.feature` additions into `features/cli/init.feature`
- [x] Copy `features/onboarding/run-discover.feature` into `features/onboarding/run-discover.feature`
- [x] Copy `features/onboarding/run-audit.feature` additions into `features/onboarding/run-audit.feature`
- [x] Move `decisions/0030-mcp-required-conventions-replace-area-docs.md` to `.grimoire/decisions/0030-mcp-required-conventions-replace-area-docs.md` and update status to `accepted`

---

<!-- ADR CONFIRMATION NOTE (manual, post-implementation):
  Test on a real project: (1) run /grimoire:discover and confirm no area docs in .grimoire/docs/
  (2) run /grimoire:plan on a real change and verify file paths come from MCP not area docs
  (3) deliberately stale a conventions rule, run grimoire map, confirm drift reported
-->
