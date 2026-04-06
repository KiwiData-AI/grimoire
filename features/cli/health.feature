Feature: Project health scoring
  As a developer
  I want to see how well my project uses grimoire
  So that I know where documentation and coverage gaps exist

  Background:
    Given a grimoire project with features and decisions

  Scenario: Calculate health score from grimoire coverage
    When I run "grimoire health"
    Then it should report scores for features, decisions, area docs, and data schema
    And it should report test coverage and unit coverage if available
    And it should report an overall score

  Scenario: Write shields.io badges to README
    Given a "README.md" with health badge markers
    When I run "grimoire health --badges README.md"
    Then badges should be written between the markers
    And the badge paths should stay within the project root

  Scenario: JSON output
    When I run "grimoire health --json"
    Then the output should be valid JSON with metrics and overall score
