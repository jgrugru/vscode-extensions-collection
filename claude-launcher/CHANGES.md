# claude-launcher: requested changes

## 1. Persist settings when the sidebar tab is switched
- Cause: VS Code destroys the webview when hidden and rebuilds `page.js`, so every field resets.
- Fix: save the form with `vscode.setState`, restore with `vscode.getState`. Don't use `retainContextWhenHidden`.
- Add `fields()`, `listBoxes()`, `saveForm()`, `restoreForm()` above `send()` in `page.js`.
  - `saveForm()` stores every `select[id]`, `input[id]`, `textarea[id]` (checkboxes by `checked`, others by `value`), the pick-list checkboxes (`input[data-g]`, keyed `g:value`), and `folderAccess()`.
  - `restoreForm()`:
    1. Apply saved values (for selects, only if the option still exists).
    2. Run `$('preset').onchange()`, since presets overwrite other fields.
    3. Apply saved values again.
    4. Run `onchange` for tools-mode, mcp-mode, plugins-mode, skills-mode, chatType, worktreeOn.
    5. Re-add saved folders: `addPicked(path)`, `chosen.set(path, {file, level})`, `paint(path)`.
    6. Call `folderHelp()`.
- `send()` calls `saveForm()`. Call `restoreForm()` right before the final `send()` at the end of the script.
- Limits: restored folders appear as extra rows even if also in the tree; the measurement results box isn't persisted.

## 2. Remove the "What are you building?" dropdown
- `page.js`: delete the `projectType` field and `projectHint` (~lines 77-78); delete the option-population loop and `$('projectType').onchange` (~189-193); remove `projectType` from `state()`; remove `'projectType'` from the id list in `restoreForm()` (or it throws on null).
- `extension.js` (optional): delete `found.projectTypes = ...` (line 40) and the `state.projectType` line in `withChat` (line 17); drop `listProjectTypes` from the `require`.
- Leave `project-plugins/` and `discover.js` alone unless removing the feature entirely.

## 3. Move "Chat type" into Advanced options
- Cut the whole Chat type block (`chatType` select + `chatHint`, ~lines 79-85).
- Paste it inside `<details class="adv">`, right after `<h2>Extras</h2>`.
- JS uses ids, so no other changes are needed.
- Assumes "extra skills" meant Chat type. Confirm before applying.

## 4. Show the Access picker expanded by default
- Move `selected` from "Whole workspace" to "Custom: choose folders and files" on the `preset` select.
- Remove `style="display:none"` from `<div class="f" id="folders">`.
- Change the initial `presetHint` text to "Pick the folders and files below."
- Restored state overrides the default after first use.
- Alternatives: move the Access block above Model, or add `size="4"` to the `preset` select.

## After editing
Run `flags.test.js`, reload the extension, and check settings survive switching sidebar tabs and back.
