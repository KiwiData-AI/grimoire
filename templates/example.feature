Feature: Login with two-factor authentication
  As a user
  I want to verify my identity with a second factor
  So that my account is protected from unauthorized access

  Background:
    Given I am on the login page

  Scenario: Successful login with valid TOTP code
    Given I have entered valid credentials
    When I enter a valid TOTP code
    Then I should be redirected to the dashboard

  Scenario: Login rejected with expired TOTP code
    Given I have entered valid credentials
    When I enter an expired TOTP code
    Then I should see an error message "Code expired"
    And I should remain on the verification page

  Scenario: Login rejected with invalid TOTP code
    Given I have entered valid credentials
    When I enter an invalid TOTP code
    Then I should see an error message "Invalid code"
    And I should remain on the verification page
