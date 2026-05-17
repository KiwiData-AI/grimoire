Feature: Pre-commit multi-persona review
  As a developer about to commit
  I want a fast multi-persona review of my local diff
  So that blocking issues are caught before the PR is opened

  Scenario: Skill targets the staged diff by default
    When I invoke "/grimoire:precommit-review"
    Then the skill should review "git diff --cached"
    And no remote requests should be required

  Scenario: Skill falls back to unstaged diff when nothing is staged
    Given there are no staged changes
    And there are unstaged changes
    When the skill runs
    Then it should review "git diff" instead
    And the output should note the fallback

  Scenario: Skill loads personas from the shared reference
    When the skill runs
    Then it should use personas listed in "skills/references/review-personas.md"
    And personas not relevant to the diff's surface should be skipped

  Scenario: Skill outputs structured findings
    When the review completes
    Then output should group findings by severity (blocker, recommended, optional)
    And each finding should include file, line, persona, and rationale

  Scenario: Skill respects scope limits
    Given the diff is larger than the configured review-scope limit
    When the skill runs
    Then it should warn that the diff is large
    And it should offer to review by file or by hunk

  Scenario: Skill exits cleanly when there is no diff
    Given the working tree has no staged and no unstaged changes
    When the skill runs
    Then it should report "no changes to review" and exit zero
    And it should not invoke any persona
