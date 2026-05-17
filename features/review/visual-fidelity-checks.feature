Feature: Cheap visual fidelity checks
  As a reviewer of a UI/UX change
  I want lightweight automated checks for token compliance and accessibility
  So that obvious drift is caught without expensive pixel-diff infrastructure

  Background:
    Given the project has `.grimoire/brand/tokens.json` configured
    And a change has either an HTML preview (`.grimoire/changes/<id>/designs/preview.html`) or post-apply UI code

  Scenario: Token-compliance lint on HTML preview
    Given the design phase has produced `preview.html`
    When the visual-fidelity check runs during design review
    Then CSS values in the HTML are scanned for hardcoded colors / spacing not present in tokens.json
    And findings flag each hardcoded value with the closest token alternative
    And findings are reported under "Visual Fidelity" in the review report

  Scenario: axe-core on HTML preview
    When the visual-fidelity check runs on `preview.html`
    Then axe-core executes against the rendered HTML
    And violations are reported with WCAG criterion, element selector, and remediation
    And severity follows axe's own taxonomy (critical / serious / moderate / minor)

  Scenario: Token-compliance lint on implementation code (post-apply)
    Given a change has been implemented and a precommit-review is running
    When the visual-fidelity check runs on staged CSS/SCSS/styled-components/Tailwind files
    Then hardcoded color/spacing values not in tokens.json are flagged
    And generated/vendored files are excluded (per `.grimoire/dupignore` pattern)

  Scenario: axe-core on rendered implementation
    Given the project has Playwright or Storybook configured (per `.grimoire/config.yaml` testing_tools)
    When the visual-fidelity check runs in precommit-review
    Then axe-core executes against rendered Storybook stories or Playwright-captured pages
    And violations are added to the review report

  Scenario: No brand tokens configured — checks skip gracefully
    Given `.grimoire/brand/tokens.json` does not exist
    When the visual-fidelity check runs
    Then token-compliance lint is skipped (no source of truth)
    And axe-core still runs (independent of brand)
    And the report notes "Token-compliance skipped: no `.grimoire/brand/tokens.json`"

  Scenario: User opts out of fidelity checks
    When the user says "skip fidelity checks"
    Then visual-fidelity checks do not run for this review
    And the skip is noted in the report summary

  Scenario: Expensive checks deferred
    When pixel-diff or visual regression is requested
    Then grimoire-review tells the user: "Pixel-diff is out of scope for v1. Use Chromatic or Percy directly and link results in the manifest."
    And does not attempt to integrate Chromatic/Percy/Applitools in this release
