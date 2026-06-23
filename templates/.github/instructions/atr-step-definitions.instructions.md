---
applyTo: "**/*Steps.java"
---

# ATR Step Definition Rules

- Step classes contain page-specific Cucumber step definitions only.
- Do not add browser setup, teardown, `Selenide.open`, driver configuration, login, or global navigation unless explicitly requested.
- Reuse existing shared steps for authentication, navigation, and lifecycle.
- Use one direct Page Object field unless the project has dependency injection conventions.
- Keep assertions readable and deterministic.
- Store only scenario-local state in fields.
- Do not duplicate steps that already exist elsewhere.
