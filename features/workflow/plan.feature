Feature: Plan implementation tasks
  As a developer with an approved feature spec and decision record
  I want grimoire to break the work into ordered tasks
  So that implementation follows a deliberate sequence aligned with the spec

  Background:
    Given an active change with at least one approved "*.feature" file

  Scenario: Plan reads only approved artifacts
    When I invoke "/grimoire:plan" on the active change
    Then the skill should base tasks on the change's "features/" and "decisions/" contents
    And it should not invent scenarios not present in the spec

  Scenario: Plan writes tasks to tasks.md in the change directory
    When the plan completes
    Then "<change>/tasks.md" should exist
    And tasks should be ordered such that scaffolding precedes implementation, which precedes verification

  Scenario: Plan reuses utilities documented in area docs
    Given ".grimoire/docs/utils.md" lists "loadConfig" and "findProjectRoot"
    When the plan involves new code under "src/core/"
    Then tasks should reference those utilities by name and file path
    And tasks should not propose re-implementing those utilities

  Scenario: Plan accounts for non-goals stated in the manifest
    Given the manifest "## Non-goals" lists "do not modify the database schema"
    When the plan runs
    Then no task should propose a database schema change

  Scenario: Plan flags missing prerequisites
    Given the change has no approved feature file
    When I invoke "/grimoire:plan"
    Then the skill should refuse to generate tasks
    And the message should name the missing prerequisite
