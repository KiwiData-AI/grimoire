Feature: Prepare a pull request from a change
  As a developer finishing a change
  I want a pull request description generated from my work
  So that reviewers understand the intent without me writing it by hand

  Scenario: A pull request description is generated after change cleanup
    Given a finalized change "add-login" whose ephemeral change folder has been removed
    And its Git history and changed live artifacts identify the change
    When I prepare a pull request
    Then a pull request description summarising the change is produced from Git history and live artifacts

  Scenario: A branch contains multiple related changes
    Given every branch commit body contains at least one "Change" line
    And the branch contains multiple related change IDs
    When I explicitly select one change for the pull request
    Then grimoire uses the selected change identity and accepts the related branch history
