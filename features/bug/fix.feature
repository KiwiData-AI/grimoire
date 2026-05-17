Feature: Disciplined bug fix
  As a developer fixing a reported bug
  I want grimoire to enforce reproduce-first methodology
  So that the fix actually addresses the underlying defect

  Scenario: Skill demands a reproduction before any code change
    When I invoke "/grimoire:bug" with a bug report
    Then the skill should refuse to draft a fix until a reproduction is captured

  Scenario: Skill writes a failing test that captures the reproduction
    When the reproduction is captured
    Then the skill should propose a failing test
    And the test should fail against the current code with the expected error

  Scenario: Skill classifies the root cause
    When the fix is proposed
    Then the skill should classify the root cause per "skills/references/bug-classification.md"
    And the classification should appear in the change manifest

  Scenario: Skill produces a tester verification checklist
    When the fix is implemented and tests pass
    Then the skill should output a checklist for a tester to confirm the fix in the running app
    And the checklist should reference the reproduction steps

  Scenario: Skill links to the originating bug report
    Given the bug originates from a report under ".grimoire/bugs/"
    When the change is drafted
    Then the manifest should reference the bug report file
