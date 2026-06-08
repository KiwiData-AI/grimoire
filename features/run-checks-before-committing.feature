Feature: Run quality checks before committing
  As a developer
  I want to run the project's quality checks on demand
  So that I catch problems before they reach a commit

  Scenario: Checks report what passed and what did not
    Given a grimoire project
    When I run the quality checks
    Then I am shown which checks passed and which did not
    And I am given an overall result
