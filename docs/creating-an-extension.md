# Creating a new extension

Copy the shape of `dlt/` (smallest one with its own activity bar icon).

## Folder

```
<name>/
  package.json
  extension.js          # activate(context) / deactivate()
  <logic>.js            # pure logic, no `vscode` import, so it is testable with plain node
  <logic>.test.js
  resources/<name>.svg  # activity bar icon, see icons.md
  README.md  LICENSE  .gitignore  .vscodeignore
```

- `.vscodeignore`: `.vscode/**`, `.git/**`, `.gitignore`, `docs/**`, `**/*.vsix`, `*.test.js` (add `node_modules/**` if you add dependencies).
- Keep pure logic separate from `extension.js`. Tests are plain `node x.test.js` scripts wired into `scripts.test`.

## package.json skeleton

```json
{
  "name": "vscode-extension-<name>",
  "displayName": "<Human Name>",
  "description": "...",
  "version": "0.1.0",
  "publisher": "jgrugru",
  "license": "MIT",
  "engines": { "vscode": "^1.84.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./extension.js",
  "contributes": { },
  "scripts": { "test": "node <logic>.test.js", "package": "npx @vscode/vsce package" },
  "devDependencies": { "@types/vscode": "^1.84.0" }
}
```

## Sidebar (activity bar) view

```json
"viewsContainers": { "activitybar": [ { "id": "<camel>", "title": "<Label>", "icon": "resources/<name>.svg" } ] },
"views": { "<camel>": [ { "id": "<camel>.<view>", "name": "<View>" } ] },
"viewsWelcome": [ { "view": "<camel>.<view>", "contents": "Empty text.\n[Action](command:<camel>.refresh)" } ]
```

- `title` on the container is the hover tooltip and the panel heading. The icon is what shows on the far left bar.
- To add a view to an existing built-in sidebar instead, use `"views": { "explorer": [...] }` (what `duckdb/` does).
- Register the tree in `activate`: `vscode.window.createTreeView('<camel>.<view>', { treeDataProvider })`. Push disposables onto `context.subscriptions`.

## Naming conventions

- Ids are `<camel>.<thing>`: container `dltPipelines`, view `dltPipelines.pipelines`, command `dltPipelines.run`. Keep one prefix per extension.
- Command titles: prefix with the product for palette-visible ones (`dlt: Run Pipeline`); short titles for tree-only commands.
- Commands that only make sense from a tree item get `{ "command": "...", "when": "false" }` under `menus.commandPalette` to hide them from the palette.
- Tree items set `contextValue`; `menus.view/item/context` uses `viewItem == <value>` with `group: "inline"` for hover buttons, other groups for the right-click menu.
- Toolbar buttons: `menus.view/title` with `group: "navigation"`, `when: "view == <id>"`.
- Codicons via `"icon": "$(refresh)"`; in code `new vscode.ThemeIcon('check')`.
- Settings under `contributes.configuration.properties`, key prefixed with the extension prefix.
- Show/hide welcome content with a context key: `vscode.commands.executeCommand('setContext', '<camel>.signedIn', bool)` plus `"when"` on `viewsWelcome`.
- Secrets: `context.secrets.get/store/delete`, never settings.

## Run and package

- Dev: open the extension folder in VS Code, press F5 (Extension Development Host).
- Package: `npm run package` in the folder, produces a `.vsix`; install with `code --install-extension <file>.vsix`. Reload the window after installing.
