Feature: Review a teammate's pull request
  As a reviewer
  I want grimoire to review a PR against the linked grimoire change
  So that review feedback is grounded in the agreed-upon spec, not just the diff

  Scenario: Skill fetches the PR diff via gh
    When I invoke "/grimoire:pr-review" with a PR number
    Then the skill should call "gh pr diff <number>"
    And the diff should be the basis for the review

  Scenario: Skill loads linked grimoire artifacts via the Change trailer
    Given the PR's commits include "Change: my-feature"
    When the skill runs
    Then it should load "features/" and "decisions/" from change "my-feature"
    And review findings should reference scenarios by name

  Scenario: Skill emits findings suitable for PR comments
    When the review completes
    Then each finding should include file, line, severity, persona, and a comment-ready body

  Scenario: Skill falls back to diff-only review when no Change trailer is present
    Given none of the PR's commits include a Change trailer
    When the skill runs
    Then it should run a diff-only multi-persona review
    And the output should note the missing trailer

  Scenario: Skill skips files outside the PR
    When the review runs
    Then findings should only reference files present in the PR diff

  Scenario: Skill errors when the PR cannot be fetched
    Given "gh pr view" fails (network down, PR number invalid, or gh not authenticated)
    When the skill runs
    Then the skill should report the fetch failure with the underlying error
    And it should not proceed to the persona review
