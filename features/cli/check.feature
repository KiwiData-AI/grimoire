Feature: Pre-commit check pipeline
  As a developer
  I want to run quality checks before committing
  So that code meets project standards

  Background:
    Given a grimoire project with configured tools

  Scenario: Run all configured check steps
    When I run "grimoire check"
    Then each configured step should execute in order
    And each step should report pass, fail, skip, or error
    And a summary should show total passed, failed, and skipped

  Scenario: Skip unconfigured steps
    Given the "security" tool is not configured
    When I run "grimoire check"
    Then the "security" step should be skipped with "not configured"

  Scenario: Stop on first failure by default
    Given the "lint" step will fail
    When I run "grimoire check"
    Then the pipeline should stop after "lint"
    And subsequent steps should not execute

  Scenario: Continue on failure with --continue
    Given the "lint" step will fail
    When I run "grimoire check --continue"
    Then all remaining steps should still execute

  Scenario: Skip specific steps
    When I run "grimoire check --skip security --skip best_practices"
    Then the "security" and "best_practices" steps should not execute

  Scenario: Run only specific steps
    When I run "grimoire check lint format"
    Then only the "lint" and "format" steps should execute

  Scenario: LLM-based check step
    Given a tool configured with name "llm" and a prompt
    And the LLM command is available
    When the step executes
    Then the prompt should be piped to the LLM via stdin
    And a response starting with "PASS" means the step passed

  Scenario: JSON output for programmatic use
    When I run "grimoire check --json"
    Then the output should be valid JSON
    And it should contain results array and summary object
