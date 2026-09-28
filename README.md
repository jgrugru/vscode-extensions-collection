# MotherDuck Explorer

Browse your [MotherDuck](https://motherduck.com) account from VS Code, natively — databases, schemas, tables and columns render inside the editor, with no browser involved anywhere except reaching a dive.

## Features

- The **MotherDuck** sidebar lists every database, drilling into schemas, tables/views and columns.
- Click a table to preview its first 100 rows in a native panel.
- Each database's **Open Dives** button opens its page on app.motherduck.com in VS Code's embedded Simple Browser — the only thing in this extension that opens a browser. Navigate to a specific dive from there.
- Each database's **Backups** group lists its snapshots, newest first, with timestamp and size.
- Download actions, all to a local `.duckdb` file you choose:
  - A database's "Download Current State".
  - A table's "Download as .duckdb File".
  - A snapshot's inline download button, which briefly restores it to a temporary MotherDuck database, copies it locally, then deletes the temporary database.

## Requirements

The `duckdb` CLI on your PATH, and a MotherDuck account. Sign in with a token from app.motherduck.com; it's stored in the editor's secret storage.

## Limits

- Dives themselves are never listed or fetched — only linked to, since there's no other way to reach them.
- Downloading a snapshot briefly creates and deletes a real MotherDuck database, so it has a small storage cost while it runs.
