---
name: atr-audit-test-ids
description: Find missing data-test-id attributes and propose safe additions.
agent: agent
---

Audit the selected React page or component for missing `data-test-id` attributes.

This is the first phase before smoke-test generation. Do not generate Page Objects, Step Definitions, or Feature files during this prompt.

Rules:
1. Read the relevant React files only.
2. Use `atr_audit_test_ids` if ATR optional MCP tools are enabled.
3. If MCP is not available, use the repository naming convention from instructions or `docs/knowledge.md`.
4. Propose one unique ID for each meaningful interactive/assertable component.
5. Report existing duplicate `data-test-id` values.
6. Do not edit files unless I explicitly ask to apply.
7. Output a table: file, component, proposed ID, reason.
8. Keep the proposal small enough to review.

Example requests:

```text
/atr-audit-test-ids Audit the Transfer page for missing test IDs.
/atr-audit-test-ids Check this selected component and propose data-test-id values.
/atr-audit-test-ids Apply the proposed IDs only after showing me the table.
/atr-audit-test-ids Re-run the audit after my changes and tell me if smoke-test generation can start.
```
