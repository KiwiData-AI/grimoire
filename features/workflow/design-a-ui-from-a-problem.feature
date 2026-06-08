@manual
Feature: Design a UI grounded in a user problem
  As a designer or developer
  I want UI design to start from a stated user problem and end in testable scenarios
  So that the design is justified and ready to build against

  # @manual — the actor is an AI agent running /grimoire:design.

  Scenario: A design starts from a problem and yields scenarios
    Given a stated user problem for a screen
    When I design it with grimoire
    Then I am offered design options grounded in that problem
    And the chosen option produces behaviour scenarios to build against

  Scenario: Every required state is accounted for
    Given a screen design in progress
    When grimoire checks it is complete
    Then it requires the empty, loading, and error states before the design is done
