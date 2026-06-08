Feature: Prepare a pull request from a change
  As a developer finishing a change
  I want a pull request description generated from my work
  So that reviewers understand the intent without me writing it by hand

  Scenario: A pull request description is generated from the change
    Given a grimoire project with an active change "add-login" on its own branch
    When I prepare a pull request
    Then a pull request description summarising the change is produced
