---
name: atr-heal-locator
description: Heal a broken Cucumber/Selenide locator with ATR.
agent: agent
---

Heal the failing locator using ATR.

Steps:
1. Identify the feature file, scenario, test command, and failed HTML path.
2. If ATR MCP is available, call `atr_self_heal_scenario`.
3. If MCP is not available, use the ATR CLI with `--approval-mode auto-test-files`.
4. Apply automatic changes only under `src/test/**`.
5. Prefer `data-test-id` selectors.
6. Rerun the test after healing.
7. Summarize broken locator, healed locator, changed file, report path, and final status.

Example requests:

```text
/atr-heal-locator Heal the failed Successful transfer scenario.
/atr-heal-locator Use target/failed-page.html and patch only test files.
/atr-heal-locator The locator broke after a data-test-id changed; run ATR and report the fix.
```
