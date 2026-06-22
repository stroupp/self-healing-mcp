package com.example.mockbanking.steps;

import com.example.mockbanking.pages.TransferPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class TransferSteps {
    private final TransferPage transferPage = new TransferPage();

    @Given("the customer opens the transfer page")
    public void theCustomerOpensTheTransferPage() {
        transferPage.openPage();
    }

    @When("the customer transfers {int} TRY to Test Recipient")
    public void theCustomerTransfersTryToTestRecipient(Integer amount) {
        transferPage.transfer(String.valueOf(amount), "Test Recipient");
    }

    @Then("the transfer confirmation is shown")
    public void theTransferConfirmationIsShown() {
        transferPage.shouldShowConfirmation();
    }
}

