@manual
Feature: Fix a bug reproduction-first
  As a developer
  I want a bug reproduced by a failing test before it is fixed
  So that the fix is proven and the bug cannot silently return

  # @manual — the actor is an AI agent running /grimoire:bug.

  Scenario: A bug is reproduced before it is fixed
    Given a reported defect whose expected behavior and reproduction are understood
    When I fix it with grimoire
    Then the defect is first reproduced by a failing test
    And the fix is complete only once that test passes

  Scenario: An unknown defect is investigated before its regression test
    Given a reported defect whose cause or reliable reproduction is unknown
    When I fix it with grimoire
    Then grimoire runs a referenced engineering spike before delivery
    And the spike records observed evidence without inventing a regression contract
    And a regression test is written first after the reproduction and direction are known

  Scenario: A defect is not turned into a new feature spec
    Given a reported defect in existing behaviour
    When I fix it with grimoire
    Then the existing behaviour spec is left as the source of truth, not rewritten
