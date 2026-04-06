Feature: Code traceability
  As a developer
  I want to trace any file back to the change that created it
  So that I understand why code exists and what requirement drove it

  Scenario: Trace a file to its originating change
    Given commits with "Change: add-login" git trailers
    When I run "grimoire trace src/auth.py"
    Then it should show commits that modified the file
    And it should show the associated change ID from trailers
    And it should link to the archived manifest

  Scenario: Trace a specific line
    Given a commit that modified line 42 of "src/auth.py"
    When I run "grimoire trace src/auth.py:42"
    Then it should show the commit that last modified that line

  Scenario: Generate release notes from archive
    Given archived changes with manifests
    When I run "grimoire log"
    Then it should list changes grouped by date
    And each entry should show the change summary and scenarios

  Scenario: Filter release notes by date range
    When I run "grimoire log --from 2026-01-01 --to 2026-03-31"
    Then only changes archived within that range should appear
