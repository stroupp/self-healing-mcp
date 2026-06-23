---
name: atr-run-feature
description: Run a Cucumber/Selenide feature and heal locator failures when appropriate.
agent: agent
---

Run the requested Cucumber/Selenide feature.

Workflow:
1. Determine the narrowest test command for the feature or scenario.
2. Run the test.
3. If it passes, report the command and result.
4. If it fails for a locator issue, use ATR MCP/CLI to heal it.
5. If it fails for non-locator reasons, stop and explain the failure.
6. Never edit production UI source during automatic healing.
7. Provide final status and ATR report path if ATR ran.

Example requests:

```text
/atr-run-feature Run the transfer feature and heal locator failures if needed.
/atr-run-feature Try the selected scenario. If a locator is broken, fix it with ATR.
/atr-run-feature Run only the smoke scenario for this feature and summarize the logs.
```
