---
applyTo: "**/*.{tsx,jsx}"
---

# ATR React Test ID Rules

- Add `data-test-id` only to meaningful interactive or assertable components.
- Do not add test IDs to layout-only wrappers unless no better target exists.
- Do not modify component behavior, state flow, validation, routing, or API calls.
- Do not change existing `data-test-id` values unless explicitly asked.
- Every relevant interactive/assertable component should have its own `data-test-id`.
- A `data-test-id` must be unique within the scanned page/component graph.
- If a duplicate exists, report it before proposing new IDs.
- Use lowercase kebab-case.
- Preferred pattern: `{project}-{page}-{type}-{name}`.
- Infer `{name}` from this order: `label`, `placeholder`, `title`, `name`, `id`, visible text, handler action, fallback index.
- Common type keys: `btn`, `input`, `select`, `textarea`, `modal`, `table`, `checkbox`, `radio`, `datepicker`, `timepicker`, `switch`, `tabs`, `form`, `menu`, `pagination`, `dropdown`, `upload`, `steps`, `map`, `nav`, `alert`.
- After proposing changes, summarize each new test ID with file path, component, and reason.
