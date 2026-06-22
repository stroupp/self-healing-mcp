---
applyTo: "**/*.feature"
---

# ATR Gherkin Rules

- Reuse existing shared login and navigation steps from the project.
- Put login and navigation in `Background` only if that is the project convention.
- Do not invent new shared infrastructure steps.
- Scenario steps must map to page-specific step definitions.
- Keep smoke scenarios short and business-critical.
- Prefer one main happy-path scenario plus a small number of essential validation scenarios.
- Use clear sentence case.
- Avoid real customer data, production identifiers, credentials, or secrets.
- Use tags consistently with the project convention.
