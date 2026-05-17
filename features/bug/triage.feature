Feature: Bug triage and routing
  As a maintainer picking up bug reports
  I want grimoire to classify root cause and route the bug correctly
  So that bugs land with the right team and the right severity

  Scenario: Skill classifies root cause from the eight categories
    When I invoke "/grimoire:bug-triage" with a bug report
    Then the classification should be one of the categories in "skills/references/bug-classification.md"

  Scenario: Skill suggests a routing target per classification
    Given the classification is "third-party"
    When the skill emits the routing
    Then the suggested route should be a third-party vendor or upstream issue
    And the suggestion should not be a code change

  Scenario: Skill flags security-sensitive bugs separately
    Given the report contains keywords matching the security pattern set
    When the skill classifies the bug
    Then the routing should include a security handling note
    And the report should be marked confidential

  Scenario: Skill records the classification on the bug report
    When triage completes
    Then the bug report file should be updated with: classification, routing target, severity

  Scenario: Skill handles incomplete reports
    Given the report is missing steps to reproduce
    When the skill triages
    Then it should request the missing information instead of guessing
