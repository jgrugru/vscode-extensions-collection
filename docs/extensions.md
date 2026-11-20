# Extensions

Monorepo layout: one folder per extension, each self-contained (own `package.json`, `LICENSE`, `README.md`, `.vscodeignore`). No build step, no bundler, no TypeScript: plain CommonJS JavaScript, `main` points straight at `extension.js`. Only dev dependency is `@types/vscode`. Publisher for all is `jgrugru`, version `0.1.0`, engine `vscode ^1.84.0`, `activationEvents: []` (VS Code activates on contributed views and commands).

| Folder | Package name | Display name | Sidebar |
|---|---|---|---|
| `dlt/` | `vscode-extension-dlt` | dlt Pipelines | own activity bar icon, label "dlt" |
| `motherduck/` | `vscode-extension-motherduck` | MotherDuck Explorer | own activity bar icon, duck |
| `duckdb/` | `vscode-extension-duckdb` | DuckDB Terminal | no activity bar icon; adds a "MotherDuck" view to the Explorer sidebar |
| `size/` | `vscode-extension-size` | Measure Size | none; adds "Measure Size" to the Explorer right-click menu |
| `assets/` | `vscode-extension-assets` | Asset Finder | own activity bar icon, stacked frames with a play triangle |

Tests: `npm test` in each folder runs plain `node <file>.test.js` (no test framework). Package: `npm run package` (`npx @vscode/vsce package`). Test files are excluded from the vsix via `.vscodeignore`.

## dlt

Finds Python files that call `dlt.pipeline()` and runs them with one click.

- `extension.js` - tree view, scan, run/stop commands, run status per file. Runs through a VS Code task of type `dltPipeline` (`file` property).
- `pipelines.js` - pure logic: `findPipeline(text)` detects a pipeline and its name, `buildCommand` builds the shell command. Tested by `pipelines.test.js`.
- Ids: view container `dltPipelines`, view `dltPipelines.pipelines`, commands `dltPipelines.run|stop|refresh`.
- Tree item `contextValue` is `dltPipeline.idle` or `dltPipeline.running`; the inline run/stop buttons key off it in `menus.view/item/context`.
- Setting `dltPipelines.runCommand` overrides the command (`${file}`, `${module}`). Default is `python <file>` or `python -m <module>` for `__main__.py`, with `uv run` when the workspace has `uv.lock`.
- Scan excludes `.venv`, `venv`, `node_modules`, `site-packages`.

## motherduck

Native tree of MotherDuck databases, schemas, tables and snapshots; row preview; open dives; download a database, table or snapshot as a local `.duckdb` file.

- `extension.js` is a 9 line shim that calls `registerMotherDuck(context)` from `motherduck.js`.
- `motherduck.js` - all UI and commands. Talks to MotherDuck by shelling out to the `duckdb` CLI (`duckdb md: -json -c <sql>`), token passed in the `motherduck_token` env var. Requires `duckdb` on PATH.
- Tree loads lazily, one small query per expand: databases (root) > Schemas / Backups groups (no query) > schemas (`schemasSql`) > tables (`tablesSql`, per schema) > columns (`columnsSql`, per table). Backups (`listSnapshotsSql`) only load when the Backups node is expanded. Never fetch a whole database's columns in one query.
- `cache.js` - `createTtlCache`: in-memory TTL cache (shares in-flight loads, skips failures). Wraps tree reads only (`cachedQuery`); previews and downloads bypass it. Setting `motherduckExplorer.cacheTtlSeconds` (default 300, 0 = off). Refresh button and sign in/out clear it. Not persisted across window reloads.
- Every query spawns a fresh `duckdb md:` process, so each expand pays connection cost. Untried speedups: one long-lived duckdb process, `attach_mode=single` connection string for `md_information_schema` queries. Both need a real token to benchmark.
- `sql.js` - SQL builders and quoting (`ident`, `sqlString`). `format.js` - byte and duration formatting. `download.js` - download target safety (no overwrite corruption, default save path). Each has a `.test.js`.
- Token: stored in `context.secrets` under `motherduck_token`; falls back to env `motherduck_token` / `MOTHERDUCK_TOKEN`. Context key `motherduckExplorer.signedIn` toggles the welcome views.
- Ids: container `motherduckExplorer`, view `motherduckExplorer.databases`, commands `motherduckExplorer.*`.
- Tree item `contextValue` values: `database`, `table`, `snapshot`; menus key off them.

## duckdb

Right-click a data file (`.duckdb .ddb .db .csv .tsv .parquet .json .jsonl .ndjson .xlsx`) in the Explorer to open it in the DuckDB UI, a terminal shell, or a schema webview, or upload it to MotherDuck.

- `extension.js` - commands, terminal launch, `DATA_READERS` map (extension to reader function).
- `proxy.js` - small framing proxy in front of the DuckDB UI port (`duckdbTerminal.uiPort`, default 4213; DuckDB itself uses the next port).
- `schema.js` - reads schema and renders the webview HTML. `sql.js` - quoting helpers.
- `motherduck.js` - its own copy of a MotherDuck browser (view `duckdbTerminal.motherduck` in the Explorer, with shares). This overlaps the `motherduck/` extension; it is a separate implementation, not shared code.
- Settings: `duckdbTerminal.uiPort`, `duckdbTerminal.executablePath`.
- `.superpowers/` and `.vscode/` are local tooling folders.

## size

Right-click any file or folder in the Explorer, **Measure Size** shows the total size in a notification (with file and folder counts, and a Copy button). Works on a multi-selection.

- `extension.js` - the `measureSize.measure` command: progress notification (cancellable), then the result message.
- `size.js` - pure logic: `measure(path, isCancelled, totals)` walks the tree with `lstat` (symlinks not followed, unreadable items counted as skipped), `formatBytes` (decimal units like Finder), `describe` builds the message. Tested by `size.test.js`.
- Ids: command `measureSize.measure`, hidden from the palette. Menu `explorer/context`, `when: resourceScheme == file`, group `7_modification@9`.
- Size is the sum of logical file sizes, not blocks on disk, so it can differ from `du`.

## assets

Sidebar gallery (webview view) of every image and video in the workspace: thumbnails, type chips (PNG, MP4, ...), name filter, click to open, right-click file actions.

- `extension.js` - webview view provider, scan, file watcher (debounced rescan), commands. Opens with the built-in `media-preview` editors (`imagePreview.previewEditor`, `vscode.videoPreview`) through `vscode.openWith`, so `.mov` and `.m4v` play too.
- `assets.js` - pure logic: `kindMap`, `walk` (own `readdir` walk, case-insensitive extensions, skips `excludeFolders`, no symlinks, capped at `maxFiles`), `thumbName`, `ffmpegArgs`, `ffmpegCandidates`.
- `thumbs.js` - `createThumbnailer`: one jpg frame per video via `ffmpeg` (keyframe near 1s with `-skip_frame nokey -noaccurate_seek`, falls back to 0s), 4 at a time and newest request first, cached in `globalStorage/thumbs` keyed by path, mtime and size. The host sends the jpg to the webview as a data URI (loading it by webview URI from globalStorage did not render). Failures go to the "Asset Finder" output channel. Tries the configured path, then `/opt/homebrew/bin` and `/usr/local/bin`, because the editor's PATH often lacks Homebrew.
- `page.js` - HTML shell and CSP. `media/view.js` and `media/view.css` - the gallery. Video thumbnails are requested lazily (IntersectionObserver); with no ffmpeg the tile falls back to a `<video preload="metadata">`.
- Tiles are grouped by folder (collapsible headers; toggle chip switches to one flat grid). With more than 24 assets in several folders, folders start closed, so only an opened folder asks for thumbnails. A search opens every match. Open/closed state and mode live in webview state.
- Thumbnail size: `assetFinder.smaller|bigger` title buttons post `zoom` to the webview, which steps a `--tile` CSS variable (kept in webview state).- Right-click menu is `menus.webview/context`; each tile carries `data-vscode-context` with `webviewSection: "asset"` and `assetPath`. Commands look the path up in the current scan (`known`), never trust it blindly.
- Ids: container `assetFinder`, view `assetFinder.assets`, commands `assetFinder.refresh|open|openExternal|revealInFinder|revealInExplorer|copyPath|copyRelativePath`.
- Settings: `assetFinder.imageExtensions`, `videoExtensions`, `excludeFolders`, `maxFiles`, `ffmpegPath`.
- Tests (`assets.test.js`) make real clips with ffmpeg when it is installed; skipped otherwise.
