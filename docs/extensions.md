# Extensions

Monorepo layout: one folder per extension, each self-contained (own `package.json`, `LICENSE`, `README.md`, `.vscodeignore`). No build step, no bundler, no TypeScript: plain CommonJS JavaScript, `main` points straight at `extension.js`. Only dev dependency is `@types/vscode`. Publisher for all is `jgrugru`, version `0.1.0`, engine `vscode ^1.84.0`, `activationEvents: []` (VS Code activates on contributed views and commands).

| Folder | Package name | Display name | Sidebar |
|---|---|---|---|
| `dlt/` | `vscode-extension-dlt` | dlt Pipelines | own activity bar icon, label "dlt" |
| `motherduck/` | `vscode-extension-motherduck` | MotherDuck Explorer | own activity bar icon, duck |
| `duckdb/` | `vscode-extension-duckdb` | DuckDB Terminal | no activity bar icon; adds a "MotherDuck" view to the Explorer sidebar |

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
