Feature: Run audit skill
  As a developer adopting grimoire on an existing project
  I want a collaborative audit that finds undocumented features and decisions
  So that the grimoire baseline reflects what already ships

  Scenario: Audit reads the existing baseline before suggesting anything
    When I invoke "/grimoire:audit"
    Then the skill should enumerate existing "*.feature" files under "features/"
    And it should enumerate existing ADRs under ".grimoire/decisions/"

  Scenario: Audit presents findings in small batches
    Given the audit finds 20 undocumented items
    When the skill reports to the user
    Then findings should be grouped by area
    And no single batch should contain more than five items at once

  Scenario: Audit lets the user confirm, skip, clarify, or group items
    When the skill presents a batch of findings
    Then each item should accept one of: confirm, skip, clarify, group

  Scenario: Audit drafts confirmed items as one or more grimoire changes
    Given the user confirmed five feature findings and three decision findings
    When the audit completes
    Then ".grimoire/changes/audit-*" should contain manifests grouping related items
    And feature findings should produce ".feature" files inside the change
    And decision findings should produce MADR files inside the change

  Scenario: Audit detects dead features
    Given a baseline "*.feature" file references code that no longer exists
    When the audit runs
    Then the dead feature should be presented to the user
    And the user should be offered remove, revive, update, or skip options

  Scenario: Audit detects stale decisions
    Given an ADR references a dependency that is no longer in the project
    When the audit runs
    Then the stale decision should be presented to the user
    And the user should be offered remove, supersede, update, or skip options

  Scenario: Audit lets the user narrow scope during the intake
    When I invoke "/grimoire:audit" and answer the scope question with "features only"
    Then the audit should only look for undocumented features
    And it should not propose decision drafts
