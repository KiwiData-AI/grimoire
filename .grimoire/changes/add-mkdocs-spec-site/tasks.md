# Tasks: add-mkdocs-spec-site

> **Change**: `grimoire docs` additionally regenerates and builds a Midnight Kiwi MkDocs spec site when `tools.spec_site` is configured; finalize runs it so the site is current.
> **Features**: `features/generate-a-spec-site.feature`
> **Decisions**: `.grimoire/decisions/0038-mkdocs-material-spec-site.md`
> **Test command**: `npm run test:bdd` (cucumber-js) · unit: `npx vitest run`
> **Status**: 12/12 tasks complete

## Reuse (import, don't rewrite)
- `generateDocs` — `src/core/docs.ts:14` (overview generation; site index reuses its `OVERVIEW.md` output)
- `execFileAsync("sh", ["-c", command], { cwd })` pattern — `src/core/check.ts:175` (running the configured build command)
- `const PACKAGE_ROOT = join(__dirname, "..", "..")` pattern — `src/core/init.ts:29` (module-local, not exported; repeat it in `site.ts`)
- `loadConfig`, `GrimoireConfig`, `ToolConfig` — `src/utils/config.ts` (`tools` is a generic `Record<string, ToolConfig>`; `tools.spec_site` needs **no** config-schema change)
- Step-def conventions — `features/steps/cli.steps.ts` (`this.run(["docs"])`, `this.dir`, existing Given "a grimoire project…" scaffolding and Then "a browsable overview of the project is produced")
- `templates/` ships in the npm package (`package.json` `files`) — new `templates/site/*` needs no packaging change

## 1. Site templates
<!-- context:
  - templates/site/  (new)
  - .grimoire/decisions/0038-mkdocs-material-spec-site.md
  - logo.png
-->
- [x] 1.1 Create `templates/site/mkdocs.yml.tpl`:
      - `site_name: {{SITE_NAME}}`, `docs_dir: docs`, `site_dir: html`
      - `theme: { name: material, palette: { scheme: slate }, logo: assets/logo.png, favicon: assets/logo.png }`
      - `plugins: [search]`
      - `markdown_extensions: [pymdownx.highlight, pymdownx.superfences, admonition]`
      - `extra_css: [assets/extra.css]`
      - `nav:` ends the file; `{{NAV}}` placeholder on the following lines (site.ts fills it)
- [x] 1.2 Create `templates/site/extra.css` — Midnight Kiwi, dark-only, scoped to `[data-md-color-scheme="slate"]`:
      - `--md-default-bg-color: #141a24`, `--md-primary-fg-color: #0e131b`, `--md-primary-fg-color--dark: #0e131b`
      - `--md-accent-fg-color: #6fd3f2`, `--md-typeset-a-color: #a8c94e`
      - `--md-default-fg-color: #d9dfe6`, code block background `#0e131b`
      - status chips: `.st-accepted` green `#a8c94e`/`#2c3a1c`, `.st-proposed` cyan `#8fdcf5`/`#173442` (used by decision pages, task 2.3)
- [x] 1.3 Copy `logo.png` (repo root) to `templates/site/logo.png` — site.ts copies it to `.grimoire/site/docs/assets/logo.png` at generation
<!-- SESSION: Section 1 done. Created templates/site/mkdocs.yml.tpl (placeholders {{SITE_NAME}} and {{NAV}}; `nav:` is the last key, {{NAV}} on its own line after it — site.ts must substitute {{NAV}} with indented list items, e.g. "  - Overview: index.md"; template validated with js-yaml after substitution), templates/site/extra.css (Midnight Kiwi tokens + .st-accepted/.st-proposed chip classes, all scoped to [data-md-color-scheme="slate"]; code bg via --md-code-bg-color), templates/site/logo.png (byte copy of repo-root logo.png, ~1.3 MB). No packaging change needed — package.json `files` already ships templates/. -->


## 2. Spec site generation (core + command)
<!-- context:
  - features/generate-a-spec-site.feature
  - src/core/site.ts  (new)
  - src/core/site.test.ts  (new)
  - src/core/docs.ts
  - src/commands/docs.ts
  - src/core/check.ts  (execFileAsync pattern, lines 1-20 and 170-180)
  - src/utils/config.ts
-->
- [x] 2.1 (verify: scenario) Add step defs to `features/steps/cli.steps.ts` for both scenarios in `generate-a-spec-site.feature` (reuse the existing When "I generate the project overview" and Then "a browsable overview…"; only Givens and the two new Thens are needed):
      - Given "a grimoire project with a spec site build configured": scaffold like the existing grimoire-project Given, then write `tools.spec_site` into `.grimoire/config.yaml` with `name: stub` and `command: mkdir -p .grimoire/site/html && touch .grimoire/site/html/index.html` (stub — tests must not require mkdocs)
      - Given "a grimoire project with no spec site build configured": scaffold with no `spec_site` tool entry
      - Then "a static spec site is produced containing the features, decisions, and constraints": assert exit 0; `.grimoire/site/mkdocs.yml` exists; `.grimoire/site/docs/features/<file>.md` exists and contains "```gherkin"; `.grimoire/site/docs/decisions/<file>.md` exists and contains the decision status; `.grimoire/site/docs/constraints.md` exists; `.grimoire/site/html/index.html` exists (proves the configured command ran, cwd = project root)
      - Then "no spec site is produced": assert exit 0 and `.grimoire/site/` does not exist
- [x] 2.2 (verify: characterization) Write `src/core/site.test.ts` (vitest, follow `src/core/docs.test.ts` tmp-dir fixture style) asserting page generation details the BDD layer doesn't pin:
      - feature page wraps the raw `.feature` content in a ```` ```gherkin ```` fence and carries an "auto-generated, do not edit" header line
      - decision page front carries the status as a chip line (`.st-accepted`/`.st-proposed` class) and preserves the MADR body
      - index.md content equals the generated `OVERVIEW.md` content
      - `{{NAV}}` in the emitted `mkdocs.yml` lists Overview, Features (one entry per feature file, grouped by subdirectory), Decisions, Constraints
      - no `tools.spec_site.command` → `buildSite` returns `{ skipped: true }` and writes nothing
      - configured command exits non-zero → `buildSite` rejects and the error message contains the command's stderr (review: the finalize-blocking guarantee must be tested)
      - `.grimoire/site/.gitignore` is written containing `docs/` and `mkdocs.yml` (only built output is committed)
- [x] 2.3 Implement `src/core/site.ts` — single export `buildSite(root: string, config: GrimoireConfig, overviewMarkdown: string): Promise<{ skipped: boolean }>`:
      - guard: `config.tools.spec_site?.command` absent → `{ skipped: true }`, no writes
      - wipe and recreate `.grimoire/site/docs/` (regeneration is authoritative; `html/` is left to the build command)
      - write `.grimoire/site/.gitignore` with `docs/` and `mkdocs.yml` — only the built `html/` is committed (review: intermediates serve no reader)
      - `docs/index.md` ← the `overviewMarkdown` parameter (never re-read from disk — `grimoire docs -o <path>` must not desync the index; review finding)
      - `docs/features/**.md` ← each `features/**/*.feature` (skip `features/steps/`), content in a gherkin fence, one page per file, preserving subdirectory grouping
      - `docs/decisions/*.md` ← each `.grimoire/decisions/*.md` except `template.md`, status chip line prepended (read status from frontmatter)
      - `docs/constraints.md` ← copy of `.grimoire/docs/constraints.md` (absent → skip the page and its nav entry)
      - `docs/assets/` ← `logo.png` + `extra.css` from `templates/site/` (module-local `PACKAGE_ROOT`, init.ts:29 pattern)
      - `mkdocs.yml` ← `templates/site/mkdocs.yml.tpl` with `{{SITE_NAME}}` = project dir basename and `{{NAV}}` = generated nav
      - run `config.tools.spec_site.command` via `execFileAsync("sh", ["-c", command], { cwd: root })` (check.ts:175 pattern); non-zero → throw with the command's stderr so `grimoire docs` exits non-zero (pre-mortem: finalize must surface build failures)
      - every generated page starts with an "auto-generated by `grimoire docs` — do not edit" line (OVERVIEW.md convention)
- [x] 2.4 Wire into the command — `src/commands/docs.ts` and `src/core/docs.ts`:
      - change `generateDocs` (src/core/docs.ts:14) to return the rendered overview markdown (it already builds the full string before writing; return it — behavior otherwise unchanged)
      - after `generateDocs(...)`, `loadConfig` + `buildSite(root, config, overviewMarkdown)`; print one line: site built at `.grimoire/site/` or "spec site: not configured, skipped"
      - update the command description to "Generate a project overview and, when configured, build the spec site" (feeds `docs:gen` CLI docs)
<!-- SESSION: Section 2 done, test-first. Signatures: `buildSite(root: string, config: GrimoireConfig, overviewMarkdown: string): Promise<{ skipped: boolean }>` (sole export of src/core/site.ts); `generateDocs(options: DocsOptions): Promise<string>` now returns the rendered overview. Decisions: pages start with "> Auto-generated by `grimoire docs` — do not edit." + blank line; decision pages strip frontmatter (matter()) and prepend `<span class="st-<first-status-word>">status</span>`; nav indent is 2/6/10 spaces (root feature files listed before subdirectory groups; Features/Decisions nav sections omitted when empty, Constraints omitted when constraints.md absent); mkdocs.yml validated by yaml parse in site.test.ts; build failure throws Error containing command + stderr, surfacing as unhandled rejection → exit 1 (commander .parse() + async action, matches repo pattern). BDD Given writes tools.spec_site by string-replacing `tools: {}` in the init-generated config.yaml. Red phase note: only the configured-scenario can genuinely fail pre-impl; the not-configured scenario passes trivially (asserts absence). Test counts after: vitest 444 (437 baseline + 7 site.test.ts), BDD 23/23. Lint: 0 errors, 2 pre-existing warnings (check.ts, configure.ts). -->

## 3. Finalize hook + documentation
<!-- context:
  - .claude/skills/grimoire-apply/SKILL.md  (finalize section, ~line 326)
  - README.md
-->
- [x] 3.1 Edit `.claude/skills/grimoire-apply/SKILL.md` finalize section (~line 326 "When all tests are green…"): add a finalize step — run `grimoire docs` before the finalize commit, so the overview and (when configured) the committed spec site in `.grimoire/site/` reflect the finished change; a failing site build blocks finalize (fix or unconfigure, don't skip silently)
- [x] 3.2 README: document the optional spec site — `tools.spec_site` config example (`command: uvx --with mkdocs-material mkdocs build -f .grimoire/site/mkdocs.yml`), what gets generated, that only `.grimoire/site/html/` is committed (intermediates gitignored), the `.gitattributes` `.grimoire/site/** linguist-generated=true` recommendation (pre-mortem mitigation), and one line: publishing the built site publishes your config/tooling summary (the index embeds the overview's Configured Tools table) — review before hosting publicly
<!-- SESSION: Section 3 done. 3.1: extended existing finalize step 4 in .claude/skills/grimoire-apply/SKILL.md (no duplicate step added) — 2-line paragraph after the "Refresh the project overview" line: spec_site regenerates/builds .grimoire/site/html/, failing build blocks finalize (fix or unconfigure, never skip silently). 3.2: added "#### Spec site" subsection at the end of README "### Rendering into your doc site" (before "### Pre-Commit Pipeline", ~line 521) — config yaml example, generated pages + Midnight Kiwi, only html/ committed via generated .gitignore, .gitattributes linguist-generated line, publish-warning sentence. Docs-only; no tests run. -->


## 4. Verification
- [x] 4.1 Run `npx vitest run` — `site.test.ts` green, no regressions
- [x] 4.2 Run `npm run test:bdd` — both new scenarios green, existing scenarios green
- [x] 4.3 Run `npm run lint`
- [x] 4.4 Real-build smoke test (validates the Pygments-gherkin assumption): in a scratch consumer project with `uv` available, configure `tools.spec_site.command`, run `grimoire docs`, open `.grimoire/site/html/index.html` — Gherkin highlighted, Midnight Kiwi palette applied, search returns a scenario name
