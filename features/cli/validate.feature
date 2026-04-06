Feature: Spec validation
  As a developer
  I want to validate my feature files and decision records
  So that specs are well-formed before implementation

  Scenario: Validate Gherkin feature files
    Given a feature file with valid Gherkin syntax
    When I run "grimoire validate"
    Then it should report no errors for that file

  Scenario: Catch missing Feature keyword
    Given a feature file without a "Feature:" line
    When I run "grimoire validate"
    Then it should report an error for the missing keyword

  Scenario: Catch missing scenarios
    Given a feature file with a Feature but no Scenario lines
    When I run "grimoire validate"
    Then it should report an error for missing scenarios

  Scenario: Validate Scenario Outline has Examples
    Given a feature file with "Scenario Outline:" but no "Examples:" section
    When I run "grimoire validate"
    Then it should report an error for missing examples

  Scenario: Validate MADR decision records
    Given a decision record with valid YAML frontmatter
    And the record has required sections (Context, Decision Outcome)
    When I run "grimoire validate"
    Then it should report no errors for that record

  Scenario: Catch missing MADR frontmatter
    Given a decision record without YAML frontmatter
    When I run "grimoire validate"
    Then it should report an error for missing frontmatter

  Scenario: Validate manifest status field
    Given a manifest with status "approved"
    When I run "grimoire validate"
    Then it should report no errors for the manifest

  Scenario: Detect conflicting changes
    Given two active changes both modify "auth/login.feature"
    When I run "grimoire list"
    Then it should warn about the conflicting feature file
