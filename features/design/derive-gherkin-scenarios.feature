Feature: Derive Gherkin scenarios from designs
  As a designer using grimoire-design
  I want grimoire to propose Gherkin scenarios for each component state
  So that engineers receive concrete behavioral specs alongside the visual design

  Background:
    Given I have enumerated component states for the selected design variant
    And grimoire-design is ready to propose Gherkin scenarios

  Scenario: Scenarios proposed for each state
    When Gherkin derivation runs
    Then grimoire-design produces draft `.feature` files at `.grimoire/changes/<id>/features/<capability>/`
    And one Scenario per component state per interactive element
    And each Scenario has Given / When / Then steps grounded in the design

  Scenario: User reviews and edits before commit
    When draft scenarios are presented
    Then grimoire-design says "Review proposed scenarios — accept, edit, or reject each"
    And I can accept all, accept some, edit, or reject any scenario
    And rejected scenarios do not get written to the change folder

  Scenario: Adversarial scenarios proposed conditionally
    Given the project has `project.surface: web` in config
    When Gherkin derivation runs
    Then keyboard-navigation scenarios are proposed per interactive component
    And screen-reader-announcement scenarios are proposed per interactive component
    And color-contrast assertion scenarios are proposed per text/UI element
    But touch-target-size scenarios are NOT proposed (no mobile surface)

  Scenario: Adversarial scenarios for TUI project
    Given the project has `project.surface: tui` in config
    When Gherkin derivation runs
    Then keyboard-navigation scenarios ARE proposed (mandatory for TUI)
    And screen-reader scenarios are NOT proposed
    And color-contrast scenarios are NOT proposed

  Scenario: Scenarios include security tags where applicable
    Given a component handles user input (form field, search box)
    When Gherkin derivation runs
    Then the proposed scenarios include `@input-validation` tag
    And include at least one negative scenario (invalid input, edge case)

  Scenario: Handoff to grimoire-draft
    When the user accepts proposed scenarios
    Then `.grimoire/changes/<id>/features/` is populated
    And grimoire-design suggests next: "Run `grimoire-draft` to refine the manifest and ADRs, or `grimoire-plan` to break into tasks"
