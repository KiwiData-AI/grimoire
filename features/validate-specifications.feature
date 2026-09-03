Feature: Validate the project's specifications
  As a developer
  I want to confirm my specs are well-formed
  So that downstream planning and review can trust them

  Scenario: Well-formed specifications pass validation
    Given a grimoire project with a documented feature
    When I validate the specifications
    Then I am told the specifications are well-formed

  Scenario: Validation reads specifications from their live homes
    Given a grimoire project with live features and decisions
    And an active change contains only coordination artifacts
    When I validate the specifications
    Then the live features and decisions are validated
    And each active change manifest is validated

  Scenario: A malformed specification is reported
    Given a grimoire project with a malformed feature
    When I validate the specifications
    Then I am told which specification is malformed
    And the validation does not pass
