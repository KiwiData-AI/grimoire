@manual
Feature: Build each task test-first
  As a developer
  I want each task implemented with a failing test before the code
  So that every behaviour is covered by a test that genuinely exercises it

  # @manual — the actor is an AI agent running /grimoire:apply.

  Scenario: A task is implemented only after its test fails first
    Given a planned task
    When I implement the task
    Then a test for it is written and seen to fail before any code is written
    And the code is written until that test passes

  Scenario: Repeated failure stops the work instead of looping
    Given a task whose tests keep failing
    When the same approach has failed several times
    Then grimoire stops and asks for guidance rather than trying again
