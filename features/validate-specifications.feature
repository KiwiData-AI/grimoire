Feature: Validate the project's specifications
  As a developer
  I want to confirm my specs are well-formed
  So that downstream planning and review can trust them

  Scenario: Well-formed specifications pass validation
    Given a grimoire project with a documented feature
    When I validate the specifications
    Then I am told the specifications are well-formed

  Scenario: A malformed specification is reported
    Given a grimoire project with a malformed feature
    When I validate the specifications
    Then I am told which specification is malformed
    And the validation does not pass
