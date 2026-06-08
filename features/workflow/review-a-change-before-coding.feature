@manual
Feature: Review a change before coding begins
  As a developer
  I want a change examined from several expert perspectives before implementation
  So that gaps and risks are caught while they are still cheap to fix

  # @manual — the actor is an AI agent running /grimoire:review with personas.

  Scenario: A change is reviewed from multiple perspectives
    Given a drafted change with its spec and plan
    When I ask grimoire to review it
    Then I receive findings covering completeness, feasibility, security, and testability

  Scenario: Blocking findings are called out distinctly
    Given a change with a serious problem
    When I ask grimoire to review it
    Then the serious problem is marked as a blocker to fix before coding
