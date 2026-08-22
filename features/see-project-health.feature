Feature: See how well a project uses grimoire
  As a developer
  I want an at-a-glance view of my project's spec and test coverage
  So that I know where the documentation and coverage gaps are

  Scenario: Health reports coverage and an overall score
    Given a grimoire project with a documented feature and a decision
    When I check the project's health
    Then I see how well specs and decisions are covered
    And I am given an overall health score

  Scenario: Health reports spec-process drift
    Given a grimoire project with a stale change and an unproven constraint
    When I check the project's health
    Then the report flags the stale change
    And the report flags the constraint that lacks a proving test
