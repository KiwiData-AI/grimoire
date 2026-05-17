Feature: Release notes from archive
  As a maintainer publishing a release
  I want a chronological summary of archived changes
  So that I can paste it into a changelog or release notes

  Scenario: Log groups entries by month
    Given ".grimoire/archive/" contains entries from two different months
    When I run "grimoire log"
    Then entries should be grouped under a month heading
    And entries within each month should be sorted by date descending

  Scenario: Log includes manifest "Why" summaries
    Given an archived change manifest with a "## Why" section
    When I run "grimoire log"
    Then the log entry should include the first line of that "Why"

  Scenario: Log filters by --from date
    Given the archive contains entries spanning six months
    When I run "grimoire log --from 2026-03-01"
    Then only entries dated on or after 2026-03-01 should appear

  Scenario: Log filters by --to date
    Given the archive contains entries spanning six months
    When I run "grimoire log --to 2026-04-30"
    Then only entries dated on or before 2026-04-30 should appear

  Scenario: Log accepts a git tag as --from
    Given an archive entry created after the "v0.1.2" tag
    When I run "grimoire log --from v0.1.2"
    Then the entry should appear in the output
    And entries from before that tag should be omitted

  Scenario: Log emits markdown by default
    When I run "grimoire log"
    Then output should be valid markdown
    And each archived change should appear as a bullet under its month

  Scenario: Log in JSON mode emits structured data
    When I run "grimoire log --json"
    Then output should be valid JSON
    And each entry should include "id", "date", "why"
