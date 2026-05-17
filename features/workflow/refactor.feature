Feature: Find and prioritise tech debt
  As a developer responsible for codebase health
  I want a prioritised register of tech-debt candidates with reasoning
  So that I can pick a manageable refactor without inventing one from scratch

  Scenario: Refactor scans across documented categories
    When I invoke "/grimoire:refactor"
    Then the skill should evaluate the codebase against the categories in "skills/references/refactor-scan-categories.md"

  Scenario: Refactor reads existing duplicate report
    Given "grimoire map --duplicates" has produced ".grimoire/docs/.snapshot.json" with a "duplicates" section
    When refactor runs
    Then duplicates should appear in the register
    And clones already listed in ".grimoire/dupignore" should be excluded

  Scenario: Refactor produces a register in the documented format
    When refactor completes
    Then the output should follow "skills/references/refactor-register-format.md"
    And each entry should include: location, category, severity, suggested action, estimated effort

  Scenario: Refactor honours debt-exceptions allowlist
    Given ".grimoire/debt-exceptions.yml" lists an accepted item
    When refactor runs
    Then the accepted item should not appear in the register

  Scenario: Refactor offers to draft a change for the top entry
    When the register is presented to the user
    Then the user should be offered to draft a grimoire change for the top-priority entry
    And accepting the offer should hand control to "/grimoire:draft"
