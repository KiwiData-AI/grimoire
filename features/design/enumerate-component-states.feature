Feature: Enumerate component states before design is "done"
  As a designer using grimoire-design
  I want grimoire to require empty, loading, and error states for each interactive surface
  So that engineers don't ship UIs that only handle the happy path

  Background:
    Given I have selected a design variant
    And grimoire-design is preparing to hand off to grimoire-draft

  Scenario: Mandatory states enumerated
    When state enumeration runs for each interactive component in the variant
    Then grimoire-design lists the following required states:
      | state | required |
      | default | yes |
      | loading | yes |
      | empty | yes |
      | error | yes |
      | success | conditional (forms, async actions) |
      | disabled | conditional (inputs, buttons) |
      | readonly | conditional (inputs) |
      | over-limit | conditional (rate-limited / quota'd actions) |
    And I must address every "required" state before the design is marked complete

  Scenario: User skips a required state — soft gate
    When I try to mark the design complete with no error state defined
    Then grimoire-design warns:
      """
      Missing error state. Most "the design didn't work in production"
      complaints trace to missing error / loading / empty handling.
      """
    And asks "Skip error state? (y/N)"
    And if I confirm, logs the skip as an unvalidated assumption in manifest.md

  Scenario: Conditional state inferred from change context
    Given the change is a form submission
    When state enumeration runs
    Then "success" state is upgraded from conditional to required
    And "over-limit" is upgraded to required if the form is rate-limited per design or brand-tokens metadata

  Scenario: Per-component preview rendered
    Given the design output is HTML (no Figma)
    When state enumeration completes
    Then `.grimoire/changes/<id>/designs/preview.html` shows each component in each state
    And each state is labeled and visually distinct (e.g., loading shimmer, error banner, empty placeholder)
