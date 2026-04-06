Feature: Change archival
  As a developer
  I want to archive completed changes
  So that the baseline reflects current state and history is preserved

  Background:
    Given a grimoire project with an active change "add-login"

  Scenario: Archive syncs features to baseline
    Given the change has proposed features in "features/auth/login.feature"
    When I run "grimoire archive add-login --yes"
    Then "features/auth/login.feature" should be updated in the baseline
    And the manifest should be copied to ".grimoire/archive/"

  Scenario: Archive syncs decisions to baseline
    Given the change has a new decision "0002-use-postgres.md"
    When I run "grimoire archive add-login --yes"
    Then the decision should appear in ".grimoire/decisions/"

  Scenario: Archive warns about incomplete tasks
    Given the change has 2 incomplete tasks
    When I run "grimoire archive add-login"
    Then it should warn about pending tasks
    And it should not archive without --yes

  Scenario: Archive removes change directory
    When I run "grimoire archive add-login --yes"
    Then ".grimoire/changes/add-login/" should no longer exist

  Scenario: Reject invalid change ID
    When I run "grimoire archive ../../etc"
    Then it should reject the change ID as invalid
