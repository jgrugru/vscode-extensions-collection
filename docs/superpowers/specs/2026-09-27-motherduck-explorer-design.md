# MotherDuck Explorer extension (v1)

Extension name: `vscode-extension-motherduck`. Display name: "MotherDuck Explorer".

## Goal

Let a developer browse everything in their MotherDuck account from a VS Code sidebar: databases, schemas, tables and columns; jump into the MotherDuck web UI (to reach dives, among other things) without leaving the editor; and download a database's current state or any of its snapshots ("backups") to a local `.duckdb` file.

This is a new, standalone extension. It does not share code or a package with the sibling `vscode-extension-duckdb`, even though that extension has an existing MotherDuck tree of its own; this one is written fresh.

## Scope

In v1:
- A sidebar tree, "MotherDuck Explorer", listing every database, drilling into schemas, tables/views and columns.
- Per database: an inline "Open in MotherDuck" button that opens `https://app.motherduck.com/database/<name>` in VS Code's built-in Simple Browser (an embedded webview tab), never the system browser. The user reaches dives by navigating there themselves; the extension never lists, fetches or renders dive content.
- Per table: click to preview the first 100 rows in a read-only webview.
- Per database: a "Backups" group listing its snapshots (`md_information_schema.database_snapshots`), newest first, each showing its timestamp and size.
- Download actions:
  - A database's context menu: "Download current state" copies it to a local `.duckdb` file the user chooses.
  - A snapshot's inline button: "Download" restores that snapshot to a local `.duckdb` file, using a temporary MotherDuck database that is always dropped afterward.
- Sign in / sign out, stored in VS Code secret storage, same shape as the sibling extension.
- Refresh button on the view.

Out of scope for v1:
- Listing or opening dives directly (see above — out by design, not by omission).
- Uploading data (that's the sibling extension's job).
- Creating or renaming shares.
- Any REST/HTTP calls to MotherDuck's API; everything goes through the `duckdb` CLI.
- Persisting tree state or download history across window reloads.

## Background

MotherDuck "backups" are snapshots, not files: `md_information_schema.database_snapshots` lists them per database with `created_ts` and byte counters, but there is no API to download one directly. A native MotherDuck database's snapshot cannot be attached read-only at a point in time either — `ATTACH ... (SNAPSHOT_TIME ...)` is only for DuckLake/Iceberg or BYOB setups. The only restore path for a native database is:

```sql
CREATE DATABASE new_db FROM source_db (SNAPSHOT_TIME 'YYYY-MM-DD HH:MM:SS');
```

This creates a real, separate MotherDuck database from the snapshot; the source is untouched. Downloading a snapshot therefore means: restore it into a throwaway MotherDuck database, copy that database to a local file, then delete the throwaway database. This has a real (small, brief) MotherDuck storage cost, so it needs a confirmation, not a silent action.

Copying a whole database's schema and data to a local file uses the DuckDB CLI's `COPY FROM DATABASE`:

```sql
ATTACH 'md:<name>';
ATTACH '<local path>' AS out;
COPY FROM DATABASE <name> TO out;
```

Verified against a live account: `md_information_schema.database_snapshots` has columns `database_name, database_id, snapshot_id, snapshot_name, created_ts, active_bytes, bytes_written, bytes_deleted, user_name, user_id`.

## Design

### Auth

Same shape as `vscode-extension-duckdb`'s `motherduck.js`: a `motherduck_token` stored in `context.secrets`, a `signIn`/`signOut` pair, and a `run(sql, options)` helper that shells out to `duckdb -json md: -c <sql>` with the token in the environment. Every command that touches MotherDuck first calls `requireSignIn()`.

### Discovery

- **Databases:** `SELECT name FROM md_information_schema.databases ORDER BY name`.
- **Schemas / tables / columns**, per database: a single `information_schema`-based query (mirroring the sibling extension's `schemaSql`), grouped client-side into schema → table → columns. Each table node shows its kind (table/view) and row count when known.
- **Snapshots**, per database: `SELECT snapshot_id, created_ts, active_bytes FROM md_information_schema.database_snapshots WHERE database_name = ? ORDER BY created_ts DESC`. Size is formatted from `active_bytes` with a pure `formatBytes(n)` helper.

The tree lazily loads each level's children on first expand, and has a Refresh button in the view title that re-runs everything below the root.

### Opening MotherDuck

The database node's inline button runs:

```js
vscode.commands.executeCommand('simpleBrowser.show', `https://app.motherduck.com/database/${encodeURIComponent(name)}`);
```

This is VS Code's bundled Simple Browser extension, confirmed present in the user's VSCodium build. If it is ever missing, the command call fails; the extension catches that and shows an error message rather than falling back to an external browser (falling back would violate the "never leave VS Code" requirement).

### Preview

Clicking a table node runs `SELECT * FROM <db>.<schema>.<table> LIMIT 100` and renders it into a webview panel, titled `<db>.<schema>.<table>`, using a small HTML table renderer (own copy of the sibling extension's `renderRowsHtml`, adapted, not imported).

### Download current state

Context menu item on a database node:
1. `vscode.window.showSaveDialog`, default filename `<db>.duckdb`.
2. Confirm dialog naming the database and destination.
3. Run, with a progress notification: `ATTACH 'md:<db>'; ATTACH '<path>' AS out; COPY FROM DATABASE <db> TO out;` — generous timeout (30 minutes, matching the sibling extension's upload timeout) since this copies a whole database.

### Download a snapshot

Inline button on a snapshot node:
1. Confirm dialog: "This temporarily creates a MotherDuck database to restore this snapshot, then deletes it. Continue?" — names the snapshot's timestamp and the temporary database name it will use.
2. `vscode.window.showSaveDialog`, default filename `<db>_<created_ts>.duckdb` (colons/spaces sanitized for a filesystem name).
3. Run, with a progress notification and the same generous timeout:
   ```sql
   CREATE DATABASE __md_explorer_restore_<random> FROM <db> (SNAPSHOT_TIME '<created_ts>');
   ATTACH '<path>' AS out;
   COPY FROM DATABASE __md_explorer_restore_<random> TO out;
   ```
4. Always runs `DROP DATABASE __md_explorer_restore_<random>` afterward, in a `finally`, whether or not the copy succeeded, so a failed download never leaves the temporary database behind.

### Error handling

- Every MotherDuck call surfaces CLI stderr through `vscode.window.showErrorMessage`, same as the sibling extension.
- A failed restore or copy still attempts the cleanup drop; if the drop itself fails, that is reported as a second error message (the user may need to remove the temp database by hand).
- An empty account (no databases) shows a welcome view with a Refresh link.

### Files

Plain JavaScript, no build step, own repo `vscode-extension-motherduck`:

- `package.json`: view container, view, commands, menus, settings (none needed beyond auth for v1).
- `extension.js`: activation, tree provider, command registration.
- `motherduck.js`: auth, the `run` helper, discovery queries, preview, download and restore flows.
- `sql.js`: pure SQL builders — `listSnapshotsSql`, `restoreSnapshotSql`, `copyDatabaseSql`, `dropDatabaseSql`, identifier/string quoting (own copy, not shared).
- `format.js`: pure `formatBytes(n)` and `formatDuration(ms)` helpers.
- `sql.test.js`, `format.test.js`: node asserts, run with `npm test`.
- `README.md`, `LICENSE` (MIT), `.vscodeignore`, `.gitignore`.

## Testing

- Unit: `npm test` covers every pure SQL builder (identifier quoting, snapshot filter, restore statement with a temp name, copy statement) and both format helpers (byte thresholds, sub-minute and multi-minute durations).
- Manual: build the `.vsix`, install it, and check against a real account: the tree lists databases/schemas/tables, Open in MotherDuck opens Simple Browser (not the system browser), a table preview loads, a current-state download produces a valid local file, and a snapshot download restores, copies, downloads, and cleans up the temporary database even when cancelled partway.

## Open questions

None for v1.
