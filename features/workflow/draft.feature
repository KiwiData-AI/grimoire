Feature: Drafting specs
  As a developer
  I want to describe what I'm building in natural language
  So that it becomes a structured, testable spec

  Scenario: Route a behavioral request to Gherkin
    Given I say "Users should be able to log in with 2FA"
    When the draft skill processes the request
    Then it should create a ".feature" file with Given/When/Then scenarios
    And it should create a manifest tracking the change

  Scenario: Route an architecture request to MADR
    Given I say "We should use PostgreSQL instead of MySQL"
    When the draft skill processes the request
    Then it should create a MADR decision record
    And the record should have Context, Considered Options, and Decision Outcome

  Scenario: Route a bug report to the bug workflow
    Given I say "The login page is broken"
    When the draft skill processes the request
    Then it should redirect to the bug skill
    And it should not create a feature file

  Scenario: Create data schema change
    Given the change requires a new database table
    When the draft skill processes the request
    Then it should create a "data.yml" in the change directory
    And it should describe the proposed schema changes

  Scenario: Manifest tracks change metadata
    When a change is drafted
    Then the manifest should have a status field set to "draft"
    And it should describe why the change is being made
    And it should list affected feature files and decisions
