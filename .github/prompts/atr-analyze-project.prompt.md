---
name: atr-analyze-project
description: Analyze the current enterprise UI automation project before making changes.
agent: agent
---

Analyze this project for ATR readiness.

Steps:
1. Use `atr_knowledge_summary` if ATR MCP is available.
2. Use `atr_analyze_project` if ATR MCP is available.
3. Otherwise inspect files manually.
4. Report detected React sources, feature files, Page Objects, step definitions, locator style, `data-test-id` usage, test command, and protected shared files.
5. Do not edit files.

Keep the answer concise and action-oriented.

Example requests:

```text
/atr-analyze-project Check whether this repo is ready for ATR.
/atr-analyze-project Analyze the current project and tell me the safest first automation task.
```
