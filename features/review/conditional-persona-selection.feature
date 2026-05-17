Feature: Conditional review persona selection by project surface
  As a project owner using grimoire-review
  I want personas to auto-wire based on project surface (TUI / web / mobile / api)
  So that I get relevant findings without persona noise

  Background:
    Given `.grimoire/config.yaml` has a `project.surface` value
    And a change with `manifest.md`, features, and tasks exists

  Scenario: Web project — accessibility personas wired
    Given `project.surface: web`
    When `grimoire-review` runs at complexity 3+
    Then the following adversarial personas auto-engage:
      | persona | included |
      | keyboard navigation | yes |
      | screen reader (ARIA) | yes |
      | color contrast / low-vision | yes |
      | responsive breakpoints | yes |
      | low bandwidth / offline | yes |
      | hostile actor | yes |
    And touch-target persona is NOT engaged

  Scenario: TUI project — keyboard-only personas wired
    Given `project.surface: tui`
    When `grimoire-review` runs at complexity 3+
    Then keyboard navigation persona engages
    And screen reader persona does NOT engage (TUI has no DOM)
    And color contrast persona does NOT engage
    And responsive-breakpoint persona does NOT engage

  Scenario: API project — security/data only
    Given `project.surface: api`
    When `grimoire-review` runs at complexity 3+
    Then no accessibility personas engage
    And API-design-convention persona engages (REST/GraphQL idioms)
    And hostile-actor persona still engages (API surface)

  Scenario: Mixed project — all personas engage
    Given `project.surface: mixed`
    When `grimoire-review` runs at complexity 3+
    Then all relevant adversarial personas engage
    And the materiality gate trims findings irrelevant to the specific change

  Scenario: User overrides at invocation
    Given `project.surface: web`
    When I run `grimoire-review --personas=keyboard,hostile`
    Then only keyboard and hostile personas engage
    And the default web roster is bypassed

  Scenario: User skips a persona
    Given default web roster is engaged
    When I say "skip color contrast — already audited externally"
    Then color contrast persona does not run
    And the skip is noted in the review report

  Scenario: No surface configured — falls back to mixed
    Given `project.surface` is not set in config
    When `grimoire-review` runs
    Then it defaults to `mixed` behavior
    And warns "No `project.surface` configured — running full persona roster. Set surface in config to filter."
