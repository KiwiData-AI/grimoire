Feature: CI orchestration
  As a CI pipeline owner
  I want one command that runs validation, checks, and test-quality with CI-aware output
  So that grimoire integrates cleanly into GitHub Actions and similar platforms

  Scenario: CI runs validate, check, and test-quality in sequence
    When I run "grimoire ci"
    Then the output should show the result of validate, check, and test-quality
    And the exit code should be non-zero if any step fails

  Scenario: CI emits GitHub Actions annotations when GITHUB_ACTIONS env is set
    Given the environment variable "GITHUB_ACTIONS" is set to "true"
    When "grimoire ci" reports a failure on a specific file and line
    Then the output should include a "::error file=...,line=..." annotation

  Scenario: CI emits GitHub Actions annotations when --annotations flag is passed
    Given the environment variable "GITHUB_ACTIONS" is unset
    When I run "grimoire ci --annotations" and a step fails
    Then the output should include a "::error file=...,line=..." annotation

  Scenario: CI escapes special characters in GHA messages
    Given an error message contains "%", ":", "\n"
    When the GHA annotation is emitted
    Then the special characters should be percent-encoded per the GHA spec

  Scenario: CI --setup scaffolds a workflow file
    When I run "grimoire ci --setup"
    Then ".github/workflows/grimoire.yml" should be created
    And the workflow should run "grimoire ci --annotations" on pull_request and push

  Scenario: CI --setup does not overwrite an existing workflow
    Given ".github/workflows/grimoire.yml" already exists
    When I run "grimoire ci --setup"
    Then the existing file should not be modified
    And the output should report that the file exists

  Scenario: CI --skip omits the listed steps
    When I run "grimoire ci --skip test-quality"
    Then the test-quality step should not run
    And the remaining steps should still execute
