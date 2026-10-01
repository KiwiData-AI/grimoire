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

  Scenario: Review blocks unjustified mechanisms
    Given a planned change contains new mechanisms
    When I ask grimoire to review it
    Then a mechanism caused only by another new mechanism is a blocker
    And replacing a working system without an accepted requirement is a blocker
    And split ownership of the same policy or event is a blocker

  Scenario: Accepted review findings receive one correction batch
    Given a completed review has accepted blocking findings
    When the findings are corrected without materially changing the design
    Then the persona review is not repeated
    And deterministic validation decides whether the design is ready

  Scenario: A material correction requires a new review
    Given a completed review has accepted blocking findings
    When a correction changes scope, architecture, a trust boundary, schema, public API, acceptance criteria, or a production entry point
    Then grimoire runs one new review against the materially changed design
