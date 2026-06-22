package com.example.mockbanking.hooks;

import com.codeborne.selenide.Selenide;
import com.codeborne.selenide.WebDriverRunner;
import io.cucumber.java.After;
import io.cucumber.java.Scenario;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public class FailureHooks {
    @After
    public void afterScenario(Scenario scenario) throws Exception {
        if (!scenario.isFailed() || !WebDriverRunner.hasWebDriverStarted()) {
            return;
        }

        Files.createDirectories(Path.of("target"));
        Files.writeString(
            Path.of("target/failed-page.html"),
            extractDomWithShadowRoots(),
            StandardCharsets.UTF_8
        );
    }

    private String extractDomWithShadowRoots() {
        String html = Selenide.executeJavaScript("""
            function escapeAttribute(value) {
              return String(value)
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            }

            function serializeNode(node) {
              if (!node) {
                return "";
              }

              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.replace(/\\s+/g, " ").trim();
                return text ? text : "";
              }

              if (node.nodeType !== Node.ELEMENT_NODE) {
                return "";
              }

              const element = node;
              const tag = element.tagName.toLowerCase();
              const attributes = Array.from(element.attributes || [])
                .map(attribute => `${attribute.name}="${escapeAttribute(attribute.value)}"`)
                .join(" ");

              let html = `<${tag}${attributes ? " " + attributes : ""}>`;

              if (element.shadowRoot) {
                html += "<shadow-root>";
                html += Array.from(element.shadowRoot.childNodes).map(serializeNode).join("");
                html += "</shadow-root>";
              }

              html += Array.from(element.childNodes).map(serializeNode).join("");
              html += `</${tag}>`;

              return html;
            }

            return serializeNode(document.documentElement);
            """);

        return html == null ? WebDriverRunner.getWebDriver().getPageSource() : html;
    }
}
