package com.example.mockbanking.pages;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;

public class TransferPage {
    private final String baseUrl = System.getProperty("app.url", "http://localhost:5173");

    public void openPage() {
        open(baseUrl);
        $("[data-test-id='transfer-page']").shouldBe(visible);
    }

    public void transfer(String amount, String recipient) {
        $("[data-test-id='recipient-name-input']").setValue(recipient);
        $("[data-test-id='transfer-amount-input']").setValue(amount);

        // Intentionally broken for ATR healing demo.
        $("[data-test-id='transfer-submit-button']").click();
    }

    public void shouldShowConfirmation() {
        $("[data-test-id='transfer-confirmation-panel']").shouldBe(visible);
        $("[data-test-id='transfer-confirmation-message']").shouldBe(visible);
    }
}
