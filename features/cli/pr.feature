Feature: PR generation
  As a developer
  I want to generate PR descriptions from grimoire artifacts
  So that PRs are well-documented and traceable

  Background:
    Given a grimoire project with an active change

  Scenario: Generate PR description from manifest
    When I run "grimoire pr"
    Then it should display a title derived from the manifest
    And the body should include the "Why" section
    And the body should list scenarios and decisions
    And the body should show task progress

  Scenario: Create PR via GitHub CLI
    Given "gh" is installed and authenticated
    When I run "grimoire pr --create"
    Then it should create a PR using "gh pr create"

  Scenario: Post-implementation review
    Given there is a diff against main
    When I run "grimoire pr --review"
    Then it should pipe the diff and PR body to the LLM for review
    And the review should flag blockers and suggestions

  Scenario: Warn about incomplete tasks
    Given the change has incomplete tasks
    When I run "grimoire pr"
    Then it should warn that tasks are still pending
