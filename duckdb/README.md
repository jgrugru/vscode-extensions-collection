# DuckDB Terminal

Right-click a DuckDB database file (`.duckdb`, `.ddb`, `.db`) or a data file (`.csv`, `.tsv`, `.parquet`, `.json`, `.jsonl`, `.ndjson`, `.xlsx`) in the Explorer:

- **DuckDB: Open in UI** starts the DuckDB UI in an editor tab.
- **DuckDB: Open in Terminal** runs the DuckDB shell in a new integrated terminal.
- **DuckDB: Show Schema** lists tables, views, columns, types and row counts in a side panel. The file is opened read-only for one query and released, so nothing stays attached. It fails if another process holds a write lock on the file, for example an open UI or shell.

A data file is exposed as a view named `data` in an in-memory database, so `SELECT * FROM data` works. The terminal starts in the file's folder.

## MotherDuck

A **MotherDuck** view in the Explorer sidebar lists your databases, shares you own, and shares shared with you. Expand a database to see tables, views and columns. Click a table to preview its first 100 rows.

- **DuckDB: MotherDuck Sign In** stores a [MotherDuck token](https://app.motherduck.com) in the editor's secret storage. A `motherduck_token` environment variable also works. Without a token the DuckDB CLI opens a browser sign-in and waits, so the extension does not call MotherDuck until a token exists.
- **DuckDB: Upload to MotherDuck** (right-click a file) asks where the file goes. A CSV, Parquet, JSON or Excel file loads into a new table: pick an existing database or create one, pick or create a schema, and name the table. A database file uploads as a new database, or its tables copy into a database and schema you pick. It asks for confirmation and fails if a name exists.
- **Create Share** (right-click a database) creates a share. You pick who can attach it and whether it is listed. `UNRESTRICTED` lets anyone with the URL attach it.

Browsing and previews run a short `duckdb md:` process per action, and MotherDuck bills for that compute.

## Requirements

The [DuckDB CLI](https://duckdb.org/docs/installation/) must be installed. `-ui` needs version 1.2.1 or newer.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `duckdbTerminal.executablePath` | `duckdb` | CLI to run. Use a full path if `duckdb` is not on PATH. |

## Develop

Open this folder in VS Code or VSCodium and press F5 to launch an Extension Development Host.

## Package and install (VSCodium)

```sh
npm run package
codium --install-extension vscode-extension-duckdb-0.0.1.vsix
```

Publish to [Open VSX](https://open-vsx.org) with `npx ovsx publish`.
