Feature: Bug reporting for testers
  As a tester
  I want grimoire to guide me through filing a reproducible bug
  So that the report is actionable for whoever picks it up

  Scenario: Skill conducts an interview-style intake
    When I invoke "/grimoire:bug-report"
    Then the skill should ask for: title, environment, expected, actual, steps to reproduce
    And it should ask follow-ups if a field is vague

  Scenario: Skill accepts output from testing tools
    Given Playwright produced a trace and a failing test output
    When the skill is invoked with the trace
    Then the report should include the test name, error, and steps

  Scenario: Skill links to existing feature specs when possible
    Given the bug behavior maps to a baseline ".feature" file
    When the skill produces the report
    Then the report should reference the matching feature and scenario name

  Scenario: Skill writes the report under .grimoire/bugs/<bug-id>/
    When the interview completes
    Then a directory ".grimoire/bugs/<bug-id>/" should be created
    And a "report.md" file should be written inside that directory
    And "<bug-id>" should encode the report date and a short title slug

  Scenario: Skill refuses to submit without minimum fields
    Given the user has provided title and actual behavior but no steps
    When the skill tries to finalise the report
    Then it should refuse to write the file
    And it should name the missing fields

  Scenario: Report stays local unless an MCP submission flow is invoked
    When the report file is written
    Then the report contents should remain under ".grimoire/bugs/<bug-id>/" only
    And no outbound network request should be made by the report-writing step
    And submission to an external tracker should require the user to explicitly invoke a configured MCP submission flow
