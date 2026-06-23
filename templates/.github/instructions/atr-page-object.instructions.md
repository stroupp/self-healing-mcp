---
applyTo: "**/*Page.java"
---

# ATR Selenide Page Object Rules

- Prefer `data-test-id` based locators.
- Use the project shadow-root helper pattern already present in the repository.
- Define one page-level `SHADOW_ROOT` constant if the project uses shadow DOM.
- Do not inline the shadow-root value repeatedly in locator declarations.
- Keep Page Objects focused on locators and small page-specific helper methods.
- Do not add browser setup, login, navigation, hooks, or test data setup to Page Objects.
- Match existing field visibility and package conventions.
- Protect shared Page Objects such as login, home, shell, hooks, and utility classes unless explicitly requested.

## Locator Shape

Use this shape when the project uses `shadowCss`:

```java
public SelenideElement elementName =
        $(shadowCss("[data-test-id='stable-id']", SHADOW_ROOT));
```

Use `ElementsCollection` only for repeated elements.
