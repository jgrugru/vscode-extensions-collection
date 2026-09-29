# CLAUDE.md

Monorepo of VS Code extensions: `dlt/`, `motherduck/`, `duckdb/`. Read [docs/](docs/README.md) first instead of re-reading the source.

## Reload after every change

Every time you change an extension, reload it so the change shows up in the editor. Do not consider the work done until this is done.

The editor is VS Code OSS. Installed extensions are plain copies (not symlinks) in `~/.vscode-oss/extensions/jgrugru.vscode-extension-<name>-<version>/`, so edits in this repo do not reach the editor on their own.

1. Copy every changed file from the extension folder into its installed folder (for example `dlt/resources/dlt.svg` to `~/.vscode-oss/extensions/jgrugru.vscode-extension-dlt-0.1.0/resources/dlt.svg`). Use `diff -r` to confirm the two match. If `package.json` changed or files were added or removed, sync those too.
2. Tell the user to run **Developer: Reload Window**. You cannot do this yourself.

If a new extension has no installed folder yet, package it (`npm run package` in its folder) and install the `.vsix`.
