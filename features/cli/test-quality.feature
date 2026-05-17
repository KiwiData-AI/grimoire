Feature: Test quality analysis
  As a developer who relies on tests as a safety net
  I want grimoire to flag weak tests that pass without proving anything
  So that low-signal tests do not give a false sense of coverage

  Scenario: Flags tests with empty bodies
    Given a test function with no statements in its body
    When I run "grimoire test-quality"
    Then the report should include the file and line
    And the issue's "rule" should be "empty-body"

  Scenario: Flags tests with no assertions
    Given a test function that calls code but never asserts on a result
    When I run "grimoire test-quality"
    Then the report should include the test
    And the issue's "rule" should be "no-assertion"

  Scenario: Flags tautological conditions
    Given a Python test containing "assert True" or "assert 1 == 1"
    When I run "grimoire test-quality"
    Then the report should flag the assertion
    And the issue's "rule" should be "tautological"

  Scenario: Flags swallowed exceptions in tests
    Given a test wraps the system under test in try/except and passes the exception
    When I run "grimoire test-quality"
    Then the report should flag the test
    And the issue's "rule" should be "swallowed-error"

  Scenario: Flags weak-assertion patterns
    Given a JavaScript test whose only assertion is "expect(true).toBe(true)" or equivalent
    When I run "grimoire test-quality"
    Then the report should flag the test
    And the issue's "rule" should be "weak-assertion"

  Scenario: Supports JavaScript and Python test files
    Given the project contains both ".test.ts" and "test_*.py" test files
    When I run "grimoire test-quality"
    Then both file types should be analysed

  Scenario: Exits non-zero when any issue is found
    Given the project contains at least one weak test
    When I run "grimoire test-quality"
    Then the exit code should be non-zero

  Scenario: JSON mode emits structured findings
    When I run "grimoire test-quality --json"
    Then output should be valid JSON
    And each finding should include "file", "line", "rule", "message"
    And every "rule" value should be one of "empty-body", "no-assertion", "tautological", "swallowed-error", "weak-assertion"
