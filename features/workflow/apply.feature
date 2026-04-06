Feature: Applying changes with red-green BDD
  As a developer
  I want the AI to implement changes with strict test discipline
  So that every behavior is verified before and after implementation

  Background:
    Given an approved change with a tasks.md plan

  Scenario: Execute tasks in order
    When the apply skill starts
    Then it should read tasks.md and find the first incomplete task
    And it should not re-plan or create its own task list

  Scenario: Red-green cycle for each task
    Given a task to write a step definition
    When the step definition is written
    Then the test must be run and must fail (red)
    And then production code is written
    And the test must be run and must pass (green)

  Scenario: Reject tests that pass immediately
    Given a newly written step definition
    When the test passes without any production code
    Then the apply skill should flag it as a false positive
    And it should not proceed until the test is fixed

  Scenario: Test quality gate after each task
    When a task completes green
    Then the test should be checked for strong assertions
    And weak assertions like "assert True" should be flagged

  Scenario: Stuck detection after repeated failures
    Given a task has failed 3 times with different approaches
    When the apply skill detects the pattern
    Then it should stop and ask the user for help
    And it should not continue looping

  Scenario: Fresh subagent per task group
    When multiple tasks are being applied
    Then each task or group of 2-3 should run in a fresh context
    And tasks.md should be the handoff mechanism between sessions

  Scenario: Git trailers on every commit
    When the apply skill commits code
    Then the commit must include a "Change:" git trailer
    And it should reference the active change ID
