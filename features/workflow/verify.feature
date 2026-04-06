Feature: Post-implementation verification
  As a developer
  I want to verify that implementation matches the spec
  So that nothing was missed or implemented incorrectly

  Background:
    Given a change has been implemented

  Scenario: Check task completeness
    When the verify skill runs
    Then it should confirm all tasks in tasks.md are marked done
    And it should report any incomplete tasks

  Scenario: Check scenario coverage
    When the verify skill runs
    Then every scenario should have a corresponding step definition
    And each step definition should have real assertions

  Scenario: Detect weak test assertions
    Given a step definition uses "assert True" or has an empty body
    When the verify skill runs
    Then it should flag the test quality issue
    And it should report the file and line number

  Scenario: Check decision coherence
    Given the change includes architecture decisions
    When the verify skill runs
    Then it should verify the implementation follows the decisions

  Scenario: Detect dead features
    Given a feature file exists but its step definitions are missing
    When the verify skill runs
    Then it should flag the feature as potentially dead
