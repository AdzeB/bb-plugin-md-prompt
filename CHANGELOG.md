# Changelog

All notable changes to MD Prompt for BB are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-28

### Added

- Live Markdown highlighting in BB's native prompt composer without changing
  the draft or the text sent to the agent.
- Syntax colours for fenced and indented code, including unfinished fences,
  using the original MIT-licensed md-prompt parser and language tokenizers.
- A composer toggle, a saved Markdown highlighting setting, and
  `bb md-prompt status`, `on`, `off` and `toggle` commands with JSON output.
- Support for compact composers and cleanup when the plugin reloads or is disabled.
- A 60,000-character guard and bounded draft cache.
- Repeatable headless browser verification with composer-only screenshots.
- Source attribution, an MIT license, contribution instructions, CI and
  GitHub releases generated from this changelog.

[Unreleased]: https://github.com/AdzeB/bb-plugin-md-prompt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AdzeB/bb-plugin-md-prompt/releases/tag/v0.1.0
