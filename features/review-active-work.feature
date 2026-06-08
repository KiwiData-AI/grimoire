Feature: Review the work currently in progress
  As a developer
  I want to see the changes in progress and how far along they are
  So that I know what is being worked on and what remains

  Scenario: Active changes are listed
    Given a grimoire project with an active change "add-login"
    When I list the active work
    Then I see the change "add-login" among the work in progress

  Scenario: A single change reports its progress
    Given a grimoire project with an active change "add-login" that is partly done
    When I check the status of "add-login"
    Then I am shown how much of the change is complete
