@manual
Feature: Fix a bug reproduction-first
  As a developer
  I want a bug reproduced by a failing test before it is fixed
  So that the fix is proven and the bug cannot silently return

  # @manual — the actor is an AI agent running /grimoire:bug.

  Scenario: A bug is reproduced before it is fixed
    Given a reported defect
    When I fix it with grimoire
    Then the defect is first reproduced by a failing test
    And the fix is complete only once that test passes

  Scenario: A defect is not turned into a new feature spec
    Given a reported defect in existing behaviour
    When I fix it with grimoire
    Then the existing behaviour spec is left as the source of truth, not rewritten
