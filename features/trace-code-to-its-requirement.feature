Feature: Trace code back to the change that introduced it
  As a developer
  I want to follow a file back to the change that created it
  So that I understand why the code exists

  Scenario: A file is traced to its originating change
    Given a grimoire project with a file committed under a change "add-login"
    When I trace that file
    Then I am shown the change that introduced it
