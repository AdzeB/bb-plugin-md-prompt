# Verification contract

Written before the BB implementation. Verify in a real BB window using an
isolated headless browser. Do not submit a prompt or start an agent.

Failure cases to exercise:

- A new composer fails to load the plugin or its CSS.
- Typing Markdown changes, removes or hides the original characters.
- An unfinished code fence remains plain until its closing fence is typed.
- A multiline paste loses line breaks, Markdown markers or Unicode characters.
- Nested styles overwrite one another, or code tokens lose the code background.
- Plain programming text such as `snake_case_name` is wrongly formatted.
- Toggling changes the draft, requires another edit, or loses the caret.
- The on/off setting is lost on navigation, page reload or plugin reload.
- Changing the setting through the CLI does not update an open composer.
- A long draft crashes or freezes the editor instead of remaining unpainted.
- Compact layout has no way to change the setting.
- Reloading or disabling the plugin leaves colours, duplicate controls or errors.
- Invalid CLI and RPC input changes the saved setting.
- An unrelated plugin's decoration or a mention pill is removed.

The repeatable E2E runner saves a JSON report and composer-only screenshots.
Traces require an explicit local opt-in and are never public release assets.
Source, build and browser evidence are reported separately. Existing upstream
parser tests are retained as upstream evidence; no new unit tests are added.
