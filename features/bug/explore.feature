Feature: Gap-aware exploratory testing
  As a tester or developer
  I want grimoire to surface untested paths and edge cases
  So that exploratory effort targets actual coverage gaps

  Scenario: Skill computes feature-to-test coverage
    When I invoke "/grimoire:bug-explore"
    Then the skill should map "*.feature" scenarios to test files
    And scenarios with no matching test should be listed first

  Scenario: Skill generates edge case suggestions
    When the skill targets a specific feature
    Then it should propose edge cases not currently covered by scenarios
    And each suggestion should include a one-line rationale

  Scenario: Suggestions in tester mode are user-action shaped
    Given the user is in tester mode
    When suggestions are presented
    Then suggestions should be expressed as user actions, not code references

  Scenario: Suggestions in developer mode reference code
    Given the user is in developer mode
    When suggestions are presented
    Then suggestions should reference code paths and existing tests

  Scenario: Skill onboards a new tester to the codebase
    When invoked in onboarding mode
    Then the skill should surface: critical user journeys, recent changes, and known-weak areas

  Scenario: Skill offers next-step handoffs after presenting gaps
    When the gap analysis is presented to the user
    Then the user should be offered to: write a `.feature` scenario for a gap directly, or file a bug report via "/grimoire:bug-report" if a gap looks already broken
