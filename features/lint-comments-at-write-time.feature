Feature: Lint comments as the agent writes them
  As a developer
  I want overly verbose comments caught the moment an agent writes them
  So that comment quality is enforced at the edit, not left to ignored instructions

  Background:
    Given a grimoire project with comment linting set to block

  Scenario: A verbose comment block is rejected at write time
    When an agent writes a multi-line comment block longer than the terse limit
    Then the write is rejected
    And the agent is shown the offending line

  Scenario: A comment referencing an external artifact is rejected
    When an agent writes a comment naming a feature file or decision id
    Then the write is rejected
    And the agent is shown the offending line

  Scenario: A placeholder stub is rejected
    When an agent writes a truncated marker such as "rest of code unchanged"
    Then the write is rejected
    And the agent is shown the offending line

  Scenario: A pre-existing comment the agent did not touch is left alone
    Given the file already contains a verbose comment
    When an agent edits an unrelated line in that file
    Then the write is accepted

  Scenario: A whole-file rewrite does not re-flag a kept comment
    Given the file already contains a verbose comment
    When an agent rewrites the whole file keeping that comment and adding a clean line
    Then the write is accepted

  Scenario: A verbose comment inserted via multi-edit is rejected
    When an agent inserts a verbose comment block via a multi-edit
    Then the write is rejected
    And the agent is shown the offending line

  Scenario: An explicit override keeps a justified comment
    When an agent writes a long comment marked with the override pragma
    Then the write is accepted

  Scenario: Warn mode surfaces issues without blocking
    Given comment linting is set to warn
    When an agent writes a verbose comment
    Then the write is accepted
    And the agent is shown the offending line

  Scenario: Linting off is a no-op
    Given comment linting is off
    When an agent writes a verbose comment
    Then the write is accepted
    And nothing is reported
