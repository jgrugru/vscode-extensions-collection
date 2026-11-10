# Claude Launcher

A sidebar panel that builds a `claude` CLI command from plain-language dropdowns, shows what it would cost in startup tokens, and starts the session in a terminal. Use it to limit what Claude can do and what it loads before a session begins.

Open it from the sliders icon in the activity bar, or run **Claude Launcher: Open**.

## Workflow

Work top to bottom, then press **Start Claude** (the bar at the bottom of the panel always stays visible, with a one-line summary above it).

### Model (collapsed bar at the top)

Defaults to **Sonnet 5.5** and **Medium** effort. Open the bar to change either. Models are pinned by full id: Fable 5.1 (`claude-fable-5-1`), Opus 5.5 (`claude-opus-5-5`), Sonnet 5.5 (`claude-sonnet-5-5`), Haiku 5.5 (`claude-haiku-5-5`), or "CLI default". Effort: low, medium, high, extra high, max, or CLI default.

### 1. What can Claude do?

- **What are you building?** loads the skills for a project type (macOS app, dlt data pipeline, VS Code extension) for that session only (see Project types below).
- **Chat type** loads one bundled skill for that session only (see Chat types below).
- **Access** is a starting point that fills in the other settings. You can still change them afterwards.
  - *Look only*: reads and searches files in this folder. Tools `Read,Glob,Grep`, locked to the folder.
  - *Work here*: reads and edits files in this folder, edits auto-accepted. Tools `Read,Glob,Grep,Edit,Write`, locked to the folder.
  - *Work anywhere*: all tools, edits auto-accepted, any folder.
  - *Custom*: leaves everything as set.
- **When to ask you**: permission mode (ask before risky actions, plan only, auto-accept edits, auto, never ask and deny, never ask and allow all).

"Locked to the folder" means `--restricted`: no shell, no web fetch, files only in the working folder, and user/project/local settings files are ignored (so your hooks and CLAUDE.md do not load under the two folder presets).

### 2. What should load at startup?

Every item is a dropdown: load all, load none, or pick from a checklist.

- **MCP servers**: all, none (`--strict-mcp-config`), or pick from this folder's `.mcp.json`. The servers that would load (from `claude mcp list`, with connection status) are listed. User-level servers and claude.ai connectors can only be on or off as a group.
- **Plugins**: all, none, or pick. Unchecked plugins are disabled through an inline `--settings` JSON (`enabledPlugins`).
- **Skills**: all, none (`--disable-slash-commands`, which also turns off slash commands), or pick. Unchecked skills are denied with `Skill(name)` in `--disallowedTools`.
- **CLAUDE.md, rules and hooks**: user, project and local; user and project; user only; project only; none (`--setting-sources`).

### 3. Extras (collapsed)

Continue the most recent conversation, session name, git worktree, minimal mode (`--bare`), safe mode (`--safe-mode`), extra instructions (`--append-system-prompt`), extra folders (`--add-dir`), always allow / always deny tool rules, stay inside this folder (`--restricted`), and customize built-in tools (all, none, or pick).

A worktree is a second checkout of your repo on its own new branch, in its own folder. Claude edits there, so your current files stay untouched. Merge the branch when you like the result.

### 4. Check and start

- **Show command** reveals the exact command and a **Copy command** button.
- **Measure this setup** and **Measure defaults** run one tiny `claude -p` request and report real input tokens (new and cached) and the dollar cost.
- **Start Claude** opens a terminal in the editor area, in the workspace folder, and runs the command.

## Token cost

- **Skills and plugins**: estimates appear next to "Load all", next to each item in the pick lists, and under the dropdown for the current choice. They are rough: the name plus description of each skill (and for plugins, their skills, agents and commands) at about 4 characters per token. MCP-only plugins show 0.
- **MCP servers**: cannot be estimated offline. **Measure MCP cost** runs two small requests, one with default settings and one with `--strict-mcp-config`, and reports the difference. It is one number for all servers and uses the CLI default model, not the model bar.
- **Measure** buttons are real API calls, so each press has a small cost.

## Chat types

Each chat type is a small plugin in [chat-plugins/](chat-plugins/) holding one skill. The launcher adds `--plugin-dir <folder>` to the command, so nothing is installed into `~/.claude`.

| Chat type | Skill | Source | Licence |
|---|---|---|---|
| Brainstorm | brainstorming | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| Teach me | socratic-method | [malkreide/socratic-method-skill](https://github.com/malkreide/socratic-method-skill) | MIT |
| Code | test-driven-development | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| Quick bug fix | systematic-debugging | written for this extension (same root-cause-first approach as common debugging guides) | MIT, same as the extension |

Notes: the brainstorming skill refers to other superpowers skills (writing-plans) and companion files that are not bundled. Choosing "Load none" for skills also disables the bundled skill. The new session still follows your own CLAUDE.md unless you set "CLAUDE.md, rules and hooks" to none.

## Project types

Each project type is a folder in [project-plugins/](project-plugins/) with the same plugin layout as a chat type, plus a `launcher.json` giving its label and hint. The dropdown is built from whatever folders exist, so adding a type is: make `project-plugins/<id>/` with `.claude-plugin/plugin.json`, `launcher.json` and `skills/<skill>/SKILL.md`, then reload the window.

Current types: macOS app, dlt data pipeline, VS Code extension. They have no skills yet. The panel says so when you pick one. A project type and a chat type can be combined, and both plugin folders are loaded.

## Where the lists come from

- **Skills**: every folder holding a `SKILL.md` under `~/.claude/skills` (including nested ones such as `synced/`) and the workspace `.claude/skills`. Skills that come from plugins are not listed one by one; use the plugin dropdown.
- **Plugins**: `~/.claude/plugins/installed_plugins.json`. It is not filtered by project, so project-scoped plugins from other folders also appear.
- **MCP**: `claude mcp list` for the server list, and the workspace `.mcp.json` for the pick list.
- Lists are read once when the panel opens. Reload the window to refresh them.

## Settings

- `claudeLauncher.executablePath` (default `claude`): path of the claude CLI.

## Development

- `npm test` runs `flags.test.js`.
- `npm run package` builds the `.vsix`.
- Files: `extension.js` (view, terminal, measure wiring), `flags.js` (pure: choices to CLI args), `page.js` (panel HTML and script), `discover.js` (skills, plugins, MCP discovery and token estimates), `measure.js` (token measurement), `chat-plugins/` and `project-plugins/` (bundled skills).
