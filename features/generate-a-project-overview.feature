Feature: Generate a human-readable project overview
  As a developer
  I want a single browsable summary of what the project does and why
  So that newcomers can understand it without reading every spec

  Scenario: An overview is produced from the project's specs and decisions
    Given a grimoire project with a documented feature and a decision
    When I generate the project overview
    Then a browsable overview of the project is produced
