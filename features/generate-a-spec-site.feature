Feature: Generate a browsable spec site
  As a developer
  I want a searchable website built from my project's features, decisions, and constraints
  So that the team can review specs without reading raw files

  Scenario: The spec site is built alongside the overview
    Given a grimoire project with a spec site build configured
    When I generate the project overview
    Then a browsable overview of the project is produced
    And a static spec site is produced containing the features, decisions, and constraints

  Scenario: Spec site generation is skipped when not configured
    Given a grimoire project with no spec site build configured
    When I generate the project overview
    Then a browsable overview of the project is produced
    And no spec site is produced
