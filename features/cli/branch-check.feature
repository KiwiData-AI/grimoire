Feature: Branch-guard hook
  As a developer using grimoire skills via Claude Code
  I want grimoire to catch new-feature work being started on the wrong branch
  So that features get their own branch and don't piggy-back on unrelated work

  Background:
    Given ".claude/hooks.json" registers "grimoire branch-check" as a "UserPromptSubmit" hook
    And the hook receives the user prompt on stdin

  Scenario: Detects new-feature intent in the user prompt
    Given the user prompt is "let's add a feature for csv export"
    When "grimoire branch-check" runs
    Then it should detect new-feature intent
    And the response should suggest a branch name derived from the prompt

  Scenario: Blocks new-feature work when branch is dirty
    Given the working tree has uncommitted changes
    And the user prompt expresses new-feature intent
    When "grimoire branch-check" runs
    Then the hook should output a blocking message
    And the message should reference the dirty state

  Scenario: Blocks new-feature work when branch already has an active change
    Given the current branch maps to an existing active change
    And the user prompt expresses intent for a different feature
    When "grimoire branch-check" runs
    Then the hook should output a blocking message
    And the message should name the existing in-progress change

  Scenario: Allows non-feature prompts to proceed silently
    Given the user prompt is "explain how validate.ts works"
    When "grimoire branch-check" runs
    Then the hook should exit zero with no blocking message

  Scenario: Suggests a clean kebab-case branch name
    Given the user prompt is "Build the CSV export endpoint!"
    When "grimoire branch-check" runs and proposes a branch
    Then the suggested branch should be lowercase
    And the suggested branch should use hyphens as separators
    And the suggested branch should not contain punctuation

  Scenario: Allows new-feature work on a clean branch and suggests a branch
    Given the working tree is clean
    And the current branch has no active grimoire change associated with it
    And the user prompt is "let's add a feature for csv export"
    When "grimoire branch-check" runs
    Then the hook should not block
    And the response should suggest a branch name derived from the prompt
    And the response should make clear the user can proceed after switching branches

  Scenario: Suggested branch name is sanitised against shell metacharacters
    Given the user prompt contains shell metacharacters such as ";", "&", "`", "$()", quotes
    When "grimoire branch-check" proposes a branch name
    Then the suggestion should contain only characters from the set [a-z0-9-]
    And no shell metacharacters should appear in the suggestion

  Scenario: Suggested branch name has a bounded length
    Given the user prompt is an extremely long sentence (>500 characters)
    When "grimoire branch-check" proposes a branch name
    Then the suggested name should be truncated to a sensible length (≤80 characters)
    And the truncated name should still be valid kebab-case

  Scenario: Hook does not persist or transmit prompt content
    When "grimoire branch-check" processes any user prompt
    Then no file under ".grimoire/" should be created or modified by the hook
    And no outbound network request should be made
    And the hook's source must not import "node:http", "node:https", "node:fs/promises#writeFile", or "node:fs/promises#appendFile"
