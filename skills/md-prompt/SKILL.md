---
name: md-prompt
description: Inspect or toggle live Markdown highlighting in BB's prompt composer.
---

# MD Prompt

This plugin paints Markdown and syntax-highlighted code in the BB composer.
It does not change, send or rewrite the draft. It runs locally in the client
and works independently of the thread's agent provider.

Use `bb md-prompt status` to read the saved setting. Use `bb md-prompt on`,
`bb md-prompt off` or `bb md-prompt toggle` when the user asks to change it.
Each command accepts `--json`. The composer Markdown icon and the plugin's
Markdown highlighting setting control the same saved preference.

Drafts over 60,000 UTF-16 code units are left plain. Code fences are painted
even before the closing fence is typed. Markdown markers remain visible.
This is a BB plugin; Claude Code's `/md-prompt` command is not involved.
