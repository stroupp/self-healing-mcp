Feature: Money transfer

  Scenario: Successful transfer
    Given the customer opens the transfer page
    When the customer transfers 100 TRY to Test Recipient
    Then the transfer confirmation is shown

