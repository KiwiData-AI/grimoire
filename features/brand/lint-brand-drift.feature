Feature: Lint for brand drift
  As a project owner with brand guidelines
  I want grimoire to detect when implementation drifts from `.grimoire/brand/tokens.json`
  So that the brand stays consistent without manual audits

  Background:
    Given `.grimoire/brand/tokens.json` exists with brand tokens defined
    And the project has UI source files (CSS, SCSS, styled-components, Tailwind, etc.)

  Scenario: Standalone lint invocation
    When I run `grimoire-design --lint`
    Then grimoire scans staged or all UI source files (configurable scope)
    And flags hardcoded color/spacing/typography values not present in tokens.json
    And produces a report at `.grimoire/changes/<id>/brand-lint-report.md` (if in a change) or stdout

  Scenario: Suggest replacement token for hardcoded value
    Given the lint finds `color: #0066ff;` in `Button.css`
    And tokens.json has a `color.primary` token with value `#0066ff`
    When the report is generated
    Then the finding suggests "Replace `#0066ff` with `var(--color-primary)` (defined in tokens.json)"

  Scenario: Flag value close to but not matching a token
    Given the lint finds `color: #0067ff;` (one digit off)
    When the report is generated
    Then the finding flags the value as "near-match" for `color.primary` (#0066ff)
    And suggests either updating to the token or adding a new variant token if intentional

  Scenario: Integration with precommit-review
    When `grimoire-precommit-review` runs
    Then brand-drift lint runs automatically if `.grimoire/brand/tokens.json` exists
    And findings appear under "Brand Drift" in the review report

  Scenario: Voice/tone drift checked on user-facing copy
    Given `.grimoire/brand/voice.md` defines voice rules (e.g., "no exclamation marks", "second person")
    When lint runs on changed user-facing strings (button labels, copy in HTML, i18n files)
    Then violations of explicit voice rules are flagged
    And severity is "suggestion" by default (voice is subjective)

  Scenario: Ignore non-design files
    When the lint scans the repo
    Then test fixtures, generated files (per `.grimoire/mapignore`), and vendor code are excluded
    And only files identified as UI source by `.grimoire/docs/index.yml` area mapping are scanned

  Scenario: No tokens configured — lint skips gracefully
    Given `.grimoire/brand/tokens.json` does not exist
    When `grimoire-design --lint` is invoked
    Then grimoire prints "No brand tokens to lint against. Run `grimoire init` or `grimoire-design --capture-brand` first."
    And exits cleanly without error

  Scenario: Clean state — no drift found
    Given `.grimoire/brand/tokens.json` exists with defined tokens
    And all scanned UI source files use token references only (no hardcoded color/spacing/typography values)
    When `grimoire-design --lint` runs
    Then the report shows zero findings
    And the report explicitly states "No brand drift detected across N files scanned"
    And the exit code is 0 (success — no findings is a valid outcome)
    And no false positives are produced for files using token references like `var(--color-primary)` or token-named SCSS variables

  Scenario: Malformed tokens.json — invalid JSON
    Given `.grimoire/brand/tokens.json` exists but is invalid JSON
    When `grimoire-design --lint` runs
    Then grimoire prints "tokens.json malformed at `<path>` — fix or remove" with a one-line description of the parse error
    And does not crash
    And exits with non-zero status to signal misconfiguration (not lint findings)

  Scenario: Malformed tokens.json — missing required $value fields
    Given `.grimoire/brand/tokens.json` is valid JSON but missing required `$value` fields
    When `grimoire-design --lint` runs
    Then grimoire prints "tokens.json malformed at `<path>` — fix or remove" with a description of the missing field
    And does not crash
    And exits with non-zero status to signal misconfiguration
