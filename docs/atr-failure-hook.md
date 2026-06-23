# ATR Failure Hook Setup

ATR self-healing needs a failed-page HTML snapshot. Before running `atr_self_heal_scenario` or `atr --test-command ... --html-file target/failed-page.html`, the test project must have a Cucumber failure hook that writes:

```text
target/failed-page.html
```

## Required Workflow

When a project has no failure hook:

1. Add the hook automatically under `src/test/**`.
2. Do not edit production UI/source files.
3. Keep hooks in the project’s existing hooks package when one exists.
4. If a hooks package does not exist, create one under the existing test package.
5. Use `@After` and write the file only when the scenario failed.
6. Capture shadow DOM as well as light DOM.
7. Rerun the failing test once to confirm `target/failed-page.html` is created.
8. Then run ATR self-healing.

## Detection

Treat the project as missing the ATR failure hook if none of these are found under `src/test/**`:

```text
target/failed-page.html
extractDomWithShadowRoots
scenario.isFailed()
WebDriverRunner.hasWebDriverStarted()
```

Existing hooks should be extended rather than duplicated. Do not place `@Before` or `@After` hooks in step definition classes if the project has a dedicated hooks package/class.

## Example Hook

Use package names that match the target project.

```java
package com.example.project.hooks;

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
```

## Cucumber Glue

If the runner uses explicit `glue`, ensure the hooks package is included. Prefer the parent test package when possible:

```java
@CucumberOptions(
    features = "src/test/resources/features",
    glue = "com.example.project"
)
```

If the project uses a narrower glue list, add the hooks package:

```java
glue = {
    "com.example.project.steps",
    "com.example.project.hooks"
}
```

## ATR Command

After the hook exists and the failed test has produced the HTML snapshot:

```powershell
atr --workspace "C:\path\to\project" --test-command ".\mvnw.cmd test" --feature "src/test/resources/features/example.feature" --scenario "Scenario name" --html-file "target/failed-page.html" --approval-mode auto-test-files
```
