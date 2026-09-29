# MotherDuck Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `vscode-extension-motherduck`, a standalone VS Code extension that browses a MotherDuck account natively (databases → schemas → tables → columns, plus snapshots), opens a database's dives in an embedded browser tab (the only thing that ever opens a browser), and downloads a database, a single table, or a snapshot to a local `.duckdb` file.

**Architecture:** Same shape as the sibling `vscode-extension-duckdb`: plain JS, no build step, one `duckdb` CLI process per query (`duckdb md: -json -c <sql>`) with the MotherDuck token in the environment. Pure SQL-building and formatting logic lives in `sql.js`/`format.js` and is unit-tested with node's `assert`; the VS Code tree, webview and command wiring lives in `motherduck.js` and `extension.js` and is verified by hand against a real account, since it needs the extension host to run.

**Tech Stack:** Node.js (no dependencies beyond `@types/vscode` for editing), the `duckdb` CLI on PATH, `@vscode/vsce` for packaging, VS Code's bundled Simple Browser extension (`simpleBrowser.show`).

**Spec:** `docs/superpowers/specs/2026-09-27-motherduck-explorer-design.md`

## Global Constraints

- Plain JavaScript, no build step, no npm dependencies beyond `@types/vscode`.
- No shared code or package with `vscode-extension-duckdb` — every file here is written fresh, even where the shape matches.
- Every MotherDuck read or write goes through the `duckdb` CLI; no REST/HTTP calls to any MotherDuck API.
- Simple Browser (`simpleBrowser.show`) is used only by the "Open Dives" action. Nothing else in the extension opens a browser tab, embedded or external.
- A snapshot download always drops its temporary restore database afterward, even when the copy step fails.
- MIT license, matching the sibling extension.

## Review Focus

- An account with zero databases shows a welcome view, not a blank or erroring tree (Task 4).
- A database with zero snapshots shows an empty "Backups" group, not an error (Task 7).
- Cancelling the confirm dialog or the save dialog during a snapshot download must leave no temporary database behind — the temp database is only created after both prompts are accepted (Task 10).
- If `simpleBrowser.show` fails or is unavailable, the extension reports an error and never falls back to the system browser (Task 6).
- A database, schema or table name containing a quote or a space must not break the generated SQL for any operation, not just plain listing (Task 2).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `README.md` (placeholder, filled in Task 11)
- Create: `resources/motherduck.svg`

**Interfaces:**
- Produces: the command IDs, view IDs and context keys every later task wires up: `motherduckExplorer.databases` (view), `motherduckExplorer.signIn`, `motherduckExplorer.signOut`, `motherduckExplorer.refresh`, `motherduckExplorer.preview`, `motherduckExplorer.openDives`, `motherduckExplorer.downloadDatabase`, `motherduckExplorer.downloadTable`, `motherduckExplorer.downloadSnapshot` (commands), `motherduckExplorer.signedIn` (context key).

- [ ] **Step 1: Create the directory and initialize git**

```bash
mkdir -p /Users/jeff/projects/vscode-extensions/vscode-extension-motherduck/resources
cd /Users/jeff/projects/vscode-extensions/vscode-extension-motherduck
git init
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "vscode-extension-motherduck",
  "displayName": "MotherDuck Explorer",
  "description": "Browse your MotherDuck databases, schemas and tables natively, open dives, and download databases, tables or snapshots as local DuckDB files",
  "version": "0.1.0",
  "publisher": "jgrugru",
  "license": "MIT",
  "engines": {
    "vscode": "^1.84.0"
  },
  "categories": [
    "Other"
  ],
  "keywords": [
    "motherduck",
    "duckdb",
    "database",
    "backup",
    "snapshot"
  ],
  "activationEvents": [],
  "main": "./extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "motherduckExplorer",
          "title": "MotherDuck",
          "icon": "resources/motherduck.svg"
        }
      ]
    },
    "views": {
      "motherduckExplorer": [
        {
          "id": "motherduckExplorer.databases",
          "name": "Databases"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "motherduckExplorer.databases",
        "contents": "Sign in to browse your MotherDuck account.\n[Sign In](command:motherduckExplorer.signIn)",
        "when": "!motherduckExplorer.signedIn"
      },
      {
        "view": "motherduckExplorer.databases",
        "contents": "No databases found in this account.\n[Refresh](command:motherduckExplorer.refresh)",
        "when": "motherduckExplorer.signedIn"
      }
    ],
    "commands": [
      {
        "command": "motherduckExplorer.signIn",
        "title": "MotherDuck: Sign In"
      },
      {
        "command": "motherduckExplorer.signOut",
        "title": "MotherDuck: Sign Out"
      },
      {
        "command": "motherduckExplorer.refresh",
        "title": "Refresh",
        "icon": "$(refresh)"
      },
      {
        "command": "motherduckExplorer.preview",
        "title": "Preview Rows"
      },
      {
        "command": "motherduckExplorer.openDives",
        "title": "Open Dives",
        "icon": "$(link-external)"
      },
      {
        "command": "motherduckExplorer.downloadDatabase",
        "title": "Download Current State"
      },
      {
        "command": "motherduckExplorer.downloadTable",
        "title": "Download as .duckdb File"
      },
      {
        "command": "motherduckExplorer.downloadSnapshot",
        "title": "Download",
        "icon": "$(desktop-download)"
      }
    ],
    "menus": {
      "commandPalette": [
        { "command": "motherduckExplorer.refresh", "when": "false" },
        { "command": "motherduckExplorer.preview", "when": "false" },
        { "command": "motherduckExplorer.openDives", "when": "false" },
        { "command": "motherduckExplorer.downloadDatabase", "when": "false" },
        { "command": "motherduckExplorer.downloadTable", "when": "false" },
        { "command": "motherduckExplorer.downloadSnapshot", "when": "false" }
      ],
      "view/title": [
        {
          "command": "motherduckExplorer.refresh",
          "when": "view == motherduckExplorer.databases && motherduckExplorer.signedIn",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "motherduckExplorer.openDives",
          "when": "view == motherduckExplorer.databases && viewItem == database",
          "group": "inline"
        },
        {
          "command": "motherduckExplorer.downloadDatabase",
          "when": "view == motherduckExplorer.databases && viewItem == database",
          "group": "motherduck@1"
        },
        {
          "command": "motherduckExplorer.preview",
          "when": "view == motherduckExplorer.databases && viewItem == table",
          "group": "inline"
        },
        {
          "command": "motherduckExplorer.downloadTable",
          "when": "view == motherduckExplorer.databases && viewItem == table",
          "group": "motherduck@1"
        },
        {
          "command": "motherduckExplorer.downloadSnapshot",
          "when": "view == motherduckExplorer.databases && viewItem == snapshot",
          "group": "inline"
        }
      ]
    }
  },
  "scripts": {
    "test": "node sql.test.js && node format.test.js",
    "package": "npx @vscode/vsce package"
  },
  "devDependencies": {
    "@types/vscode": "^1.84.0"
  }
}
```

- [ ] **Step 3: Write `LICENSE`**

```
MIT License

Copyright (c) 2026 jgrugru
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
*.vsix
.vscode-test/
.DS_Store
```

- [ ] **Step 5: Write `.vscodeignore`**

```
.vscode/**
.git/**
.gitignore
docs/**
**/*.vsix
*.test.js
```

- [ ] **Step 6: Write `resources/motherduck.svg`**

A plain line-art glyph for the activity bar icon — a database cylinder with a small wave, using `currentColor` so it follows the theme (own original art, not a MotherDuck or DuckDB logo):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="12" cy="6" rx="7" ry="2.5"/>
  <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>
  <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>
</svg>
```

- [ ] **Step 7: Write a placeholder `README.md`**

```markdown
# MotherDuck Explorer

Browse your MotherDuck account from VS Code. Filled in fully in Task 11.
```

- [ ] **Step 8: Verify the manifest parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo ok`
Expected: `ok`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold vscode-extension-motherduck

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: SQL builders and row shaping (`sql.js`)

**Files:**
- Create: `sql.js`
- Test: `sql.test.js`

**Interfaces:**
- Produces: `sqlString(value)`, `ident(name)`, `qualified(...parts)`, `schemaSql(databaseSql)`, `groupSchemaRows(rows)`, `listSnapshotsSql(database)`, `restoreSnapshotSql(source, tempName, snapshotTime)`, `copyDatabaseSql(database, targetAlias)`, `copyTableSql(database, schema, table, targetAlias)`, `dropDatabaseSql(name)`. Every later task that builds SQL uses only these.

- [ ] **Step 1: Write the failing test**

```js
// sql.test.js
const assert = require('assert');
const {
	sqlString, ident, qualified, schemaSql, groupSchemaRows,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
} = require('./sql');

assert.strictEqual(sqlString("it's"), "'it''s'");
assert.strictEqual(ident('my "db"'), '"my ""db"""');
assert.strictEqual(qualified('db', 'main', 't'), '"db"."main"."t"');

assert.ok(schemaSql("'my_db'").includes("c.database_name = 'my_db'"));

assert.deepStrictEqual(
	groupSchemaRows([
		{ schema_name: 'main', table_name: 'a', column_name: 'id', data_type: 'INTEGER', is_nullable: false, kind: 'table', row_count: 10 },
		{ schema_name: 'main', table_name: 'a', column_name: 'name', data_type: 'VARCHAR', is_nullable: true, kind: 'table', row_count: 10 },
		{ schema_name: 'raw', table_name: 'b', column_name: 'x', data_type: 'DOUBLE', is_nullable: true, kind: 'view', row_count: null },
	]),
	[
		{ schema: 'main', tables: [{ table: 'a', kind: 'table', rows: 10, columns: [
			{ name: 'id', type: 'INTEGER', nullable: false },
			{ name: 'name', type: 'VARCHAR', nullable: true },
		] }] },
		{ schema: 'raw', tables: [{ table: 'b', kind: 'view', rows: null, columns: [
			{ name: 'x', type: 'DOUBLE', nullable: true },
		] }] },
	],
);
assert.deepStrictEqual(groupSchemaRows([]), []);

assert.strictEqual(
	listSnapshotsSql("o'db"),
	"SELECT snapshot_id, created_ts, active_bytes FROM md_information_schema.database_snapshots WHERE database_name = 'o''db' ORDER BY created_ts DESC",
);

assert.strictEqual(
	restoreSnapshotSql('my_db', '__md_explorer_restore_ab12', '2026-09-07 15:37:06.644'),
	'CREATE DATABASE "__md_explorer_restore_ab12" FROM "my_db" (SNAPSHOT_TIME \'2026-09-07 15:37:06.644\');',
);
assert.strictEqual(
	restoreSnapshotSql('my "quoted" db', '__md_explorer_restore_ab12', '2026-09-07 15:37:06.644'),
	'CREATE DATABASE "__md_explorer_restore_ab12" FROM "my ""quoted"" db" (SNAPSHOT_TIME \'2026-09-07 15:37:06.644\');',
);

assert.strictEqual(copyDatabaseSql('my_db', 'out'), 'COPY FROM DATABASE "my_db" TO "out";');

assert.strictEqual(
	copyTableSql('my_db', 'raw', 'customers', 'out'),
	'CREATE TABLE "out"."customers" AS SELECT * FROM "my_db"."raw"."customers";',
);
assert.strictEqual(
	copyTableSql('my db', 'raw', 'my "table"', 'out'),
	'CREATE TABLE "out"."my ""table""" AS SELECT * FROM "my db"."raw"."my ""table""";',
);

assert.strictEqual(dropDatabaseSql('__md_explorer_restore_ab12'), 'DROP DATABASE "__md_explorer_restore_ab12";');

console.log('ok');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node sql.test.js`
Expected: `Error: Cannot find module './sql'`

- [ ] **Step 3: Write `sql.js`**

```js
/** Quote a value as a SQL string literal. @param {string} value */
function sqlString(value) {
	return `'${value.replace(/'/g, "''")}'`;
}

/** Quote a name as a SQL identifier. @param {string} name */
function ident(name) {
	return `"${name.replace(/"/g, '""')}"`;
}

/** Quote and join a dotted name, such as database.schema.table. @param {...string} parts */
function qualified(...parts) {
	return parts.map(ident).join('.');
}

/** @param {string} databaseSql SQL expression for the database name, e.g. a quoted literal */
function schemaSql(databaseSql) {
	return `
SELECT c.schema_name, c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_index,
       CASE WHEN t.table_name IS NULL THEN 'view' ELSE 'table' END AS kind,
       t.estimated_size AS row_count
FROM duckdb_columns() c
LEFT JOIN duckdb_tables() t
  ON t.database_name = c.database_name AND t.schema_name = c.schema_name AND t.table_name = c.table_name
WHERE NOT c.internal AND c.database_name = ${databaseSql}
ORDER BY c.schema_name, c.table_name, c.column_index`;
}

/**
 * Group schemaSql's flat column rows into schemas, each with its tables and their columns.
 * @param {any[]} rows
 * @returns {{schema: string, tables: {table: string, kind: string, rows: number | null, columns: {name: string, type: string, nullable: boolean}[]}[]}[]}
 */
function groupSchemaRows(rows) {
	const schemas = new Map();
	for (const row of rows) {
		if (!schemas.has(row.schema_name)) {
			schemas.set(row.schema_name, new Map());
		}
		const tables = schemas.get(row.schema_name);
		if (!tables.has(row.table_name)) {
			tables.set(row.table_name, { table: row.table_name, kind: row.kind, rows: row.row_count, columns: [] });
		}
		tables.get(row.table_name).columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable });
	}
	return [...schemas.entries()].map(([schema, tables]) => ({ schema, tables: [...tables.values()] }));
}

/** @param {string} database */
function listSnapshotsSql(database) {
	return `SELECT snapshot_id, created_ts, active_bytes FROM md_information_schema.database_snapshots WHERE database_name = ${sqlString(database)} ORDER BY created_ts DESC`;
}

/**
 * Restore a snapshot of `source` into a brand-new database `tempName`. The source is untouched.
 * @param {string} source @param {string} tempName @param {string} snapshotTime
 */
function restoreSnapshotSql(source, tempName, snapshotTime) {
	return `CREATE DATABASE ${ident(tempName)} FROM ${ident(source)} (SNAPSHOT_TIME ${sqlString(snapshotTime)});`;
}

/** Copy a whole attached database's schema and data into another attached database. @param {string} database @param {string} targetAlias */
function copyDatabaseSql(database, targetAlias) {
	return `COPY FROM DATABASE ${ident(database)} TO ${ident(targetAlias)};`;
}

/** Copy one table's data into a new table in another attached database. @param {string} database @param {string} schema @param {string} table @param {string} targetAlias */
function copyTableSql(database, schema, table, targetAlias) {
	return `CREATE TABLE ${qualified(targetAlias, table)} AS SELECT * FROM ${qualified(database, schema, table)};`;
}

/** @param {string} name */
function dropDatabaseSql(name) {
	return `DROP DATABASE ${ident(name)};`;
}

module.exports = {
	sqlString, ident, qualified, schemaSql, groupSchemaRows,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node sql.test.js`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add sql.js sql.test.js
git commit -m "feat: add SQL builders and schema row grouping

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Formatting helpers (`format.js`)

**Files:**
- Create: `format.js`
- Test: `format.test.js`

**Interfaces:**
- Produces: `formatBytes(bytes)`, `formatDuration(ms)`. Used by the tree (snapshot size) and by every download command (completion message).

- [ ] **Step 1: Write the failing test**

```js
// format.test.js
const assert = require('assert');
const { formatBytes, formatDuration } = require('./format');

assert.strictEqual(formatBytes(0), '0 B');
assert.strictEqual(formatBytes(500), '500 B');
assert.strictEqual(formatBytes(1024), '1.0 KB');
assert.strictEqual(formatBytes(1536), '1.5 KB');
assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.0 GB');

assert.strictEqual(formatDuration(500), '0.5s');
assert.strictEqual(formatDuration(12300), '12.3s');
assert.strictEqual(formatDuration(65000), '1m 5s');
assert.strictEqual(formatDuration(125000), '2m 5s');

console.log('ok');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node format.test.js`
Expected: `Error: Cannot find module './format'`

- [ ] **Step 3: Write `format.js`**

```js
/** Format a byte count for display, e.g. "12.3 KB", "1.2 MB". @param {number} bytes */
function formatBytes(bytes) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(1)} ${units[unit]}`;
}

/** Format a duration for display, e.g. "1.2s", "3m 5s". @param {number} ms */
function formatDuration(ms) {
	const s = ms / 1000;
	return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

module.exports = { formatBytes, formatDuration };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node format.test.js`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add format.js format.test.js
git commit -m "feat: add byte and duration formatting helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Auth, the run helper, and the database list

**Files:**
- Create: `extension.js`
- Create: `motherduck.js`

**Interfaces:**
- Consumes: nothing yet from `sql.js`/`format.js`.
- Produces: `registerMotherDuck(context)`; the tree node shape `{ kind: 'database', name: string }`; the internal `query(sql, options)` async function that every later task's commands call; the `changed` event emitter that later tasks fire to refresh the tree; the `requireSignIn()` guard every write command calls first.

- [ ] **Step 1: Write `extension.js`**

```js
const { registerMotherDuck } = require('./motherduck');

function activate(context) {
	registerMotherDuck(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
```

- [ ] **Step 2: Write `motherduck.js`**

```js
const vscode = require('vscode');
const { execFile } = require('child_process');

const TOKEN_KEY = 'motherduck_token';
const RUN_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Run one query against MotherDuck through the DuckDB CLI and parse its JSON output.
 * @param {string} sql @param {string} token @param {{setup?: string, timeout?: number}} [options]
 * @returns {Promise<any[]>}
 */
function run(sql, token, options = {}) {
	const args = ['md:'];
	if (options.setup) {
		args.push('-cmd', options.setup);
	}
	args.push('-json', '-c', sql);
	return new Promise((resolve, reject) => {
		execFile('duckdb', args, {
			maxBuffer: 64 * 1024 * 1024,
			timeout: options.timeout ?? RUN_TIMEOUT_MS,
			env: { ...process.env, motherduck_token: token },
		}, (err, stdout, stderr) => {
			if (err) {
				reject(new Error((stderr || err.message).trim()));
				return;
			}
			resolve(stdout.trim() ? JSON.parse(stdout) : []);
		});
	});
}

/** @param {vscode.ExtensionContext} context */
function registerMotherDuck(context) {
	const changed = new vscode.EventEmitter();

	async function token() {
		return (await context.secrets.get(TOKEN_KEY)) || process.env.motherduck_token || process.env.MOTHERDUCK_TOKEN || '';
	}

	async function updateSignedIn() {
		await vscode.commands.executeCommand('setContext', 'motherduckExplorer.signedIn', Boolean(await token()));
	}

	/** @param {string} sql @param {{setup?: string, timeout?: number}} [options] */
	async function query(sql, options = {}) {
		const value = await token();
		if (!value) {
			throw new Error('Not signed in to MotherDuck.');
		}
		return run(sql, value, options);
	}

	async function requireSignIn() {
		if (await token()) {
			return true;
		}
		const pick = await vscode.window.showWarningMessage('Sign in to MotherDuck first.', 'Sign In');
		return pick === 'Sign In' ? signIn() : false;
	}

	async function signIn() {
		const value = await vscode.window.showInputBox({
			title: 'MotherDuck token',
			prompt: 'Paste a token from app.motherduck.com. It is stored in the editor\'s secret storage.',
			password: true,
			ignoreFocusOut: true,
		});
		if (!value) {
			return false;
		}
		await context.secrets.store(TOKEN_KEY, value.trim());
		await updateSignedIn();
		changed.fire(undefined);
		return true;
	}

	async function signOut() {
		await context.secrets.delete(TOKEN_KEY);
		await updateSignedIn();
		changed.fire(undefined);
	}

	/** @implements {vscode.TreeDataProvider<any>} */
	const provider = {
		onDidChangeTreeData: changed.event,

		getTreeItem(node) {
			if (node.kind === 'database') {
				const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Collapsed);
				item.iconPath = new vscode.ThemeIcon('database');
				item.contextValue = 'database';
				return item;
			}
			throw new Error(`Unknown node kind: ${node.kind}`);
		},

		async getChildren(node) {
			if (!(await token())) {
				return [];
			}
			try {
				if (!node) {
					return (await query('SELECT name FROM md_information_schema.databases ORDER BY name'))
						.map((r) => ({ kind: 'database', name: r.name }));
				}
			} catch (err) {
				vscode.window.showErrorMessage(`MotherDuck: ${err.message}`);
			}
			return [];
		},
	};

	updateSignedIn();
	context.subscriptions.push(
		changed,
		vscode.window.registerTreeDataProvider('motherduckExplorer.databases', provider),
		vscode.commands.registerCommand('motherduckExplorer.signIn', signIn),
		vscode.commands.registerCommand('motherduckExplorer.signOut', signOut),
		vscode.commands.registerCommand('motherduckExplorer.refresh', () => changed.fire(undefined)),
	);
}

module.exports = { registerMotherDuck };
```

- [ ] **Step 3: Verify both files are syntactically valid**

Run: `node --check extension.js && node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 4: Package and install for a manual check**

```bash
npx @vscode/vsce package --allow-missing-repository
codium --install-extension vscode-extension-motherduck-0.1.0.vsix --force
```

Reload the window, open the MotherDuck view. Expected: a welcome message with a Sign In link. Click it, paste a token. Expected: the view lists your database names. Run "MotherDuck: Sign Out" from the command palette. Expected: the sign-in welcome message returns. If you have (or can temporarily use) an account with zero databases, confirm the signed-in-but-empty welcome message ("No databases found...") appears instead of a blank tree.

- [ ] **Step 5: Commit**

```bash
git add extension.js motherduck.js
git commit -m "feat: add auth, run helper, and the database list tree

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Schemas, tables, columns, and row preview

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: `schemaSql`, `groupSchemaRows` from `sql.js` (first use in this file — add the `require`).
- Produces: node shapes `{ kind: 'schemasGroup', database }`, `{ kind: 'schema', database, name, tables }`, `{ kind: 'table', database, relation }`, `{ kind: 'column', column }`, and the `motherduckExplorer.preview` command that Task 8/9's context menus sit beside.

- [ ] **Step 1: Add the `sql.js` import**

At the top of `motherduck.js`, alongside the existing `require`s:

```js
const { schemaSql, groupSchemaRows, ident, sqlString } = require('./sql');
```

- [ ] **Step 2: Extend `getTreeItem` with the new node kinds**

Replace the `getTreeItem` function's body (still throwing on an unknown kind, now after four new `if` branches placed before the `database` check or after it — order does not matter since each checks its own `node.kind`):

```js
getTreeItem(node) {
	const Collapsed = vscode.TreeItemCollapsibleState.Collapsed;
	const None = vscode.TreeItemCollapsibleState.None;
	if (node.kind === 'database') {
		const item = new vscode.TreeItem(node.name, Collapsed);
		item.iconPath = new vscode.ThemeIcon('database');
		item.contextValue = 'database';
		return item;
	}
	if (node.kind === 'schemasGroup') {
		const item = new vscode.TreeItem('Schemas', Collapsed);
		item.contextValue = 'schemasGroup';
		return item;
	}
	if (node.kind === 'backupsGroup') {
		const item = new vscode.TreeItem('Backups', Collapsed);
		item.contextValue = 'backupsGroup';
		return item;
	}
	if (node.kind === 'schema') {
		const item = new vscode.TreeItem(node.name, Collapsed);
		item.iconPath = new vscode.ThemeIcon('symbol-namespace');
		item.contextValue = 'schema';
		return item;
	}
	if (node.kind === 'table') {
		const r = node.relation;
		const item = new vscode.TreeItem(r.table, Collapsed);
		item.description = [r.kind, r.rows != null ? `${r.rows.toLocaleString()} rows` : null].filter(Boolean).join(' · ');
		item.iconPath = new vscode.ThemeIcon(r.kind === 'view' ? 'eye' : 'table');
		item.contextValue = 'table';
		item.command = { command: 'motherduckExplorer.preview', title: 'Preview', arguments: [node] };
		return item;
	}
	if (node.kind === 'column') {
		const item = new vscode.TreeItem(node.column.name, None);
		item.description = `${node.column.type}${node.column.nullable ? '' : ' · NOT NULL'}`;
		item.iconPath = new vscode.ThemeIcon('symbol-field');
		return item;
	}
	throw new Error(`Unknown node kind: ${node.kind}`);
},
```

- [ ] **Step 3: Extend `getChildren`**

Inside the existing `try` block in `getChildren`, after the `if (!node) { ... }` branch that lists databases, add:

```js
if (node.kind === 'database') {
	return [
		{ kind: 'schemasGroup', database: node.name },
		{ kind: 'backupsGroup', database: node.name },
	];
}
if (node.kind === 'schemasGroup') {
	const rows = await query(schemaSql(sqlString(node.database)));
	return groupSchemaRows(rows).map((s) => ({ kind: 'schema', database: node.database, name: s.schema, tables: s.tables }));
}
if (node.kind === 'backupsGroup') {
	return [];
}
if (node.kind === 'schema') {
	return node.tables.map((relation) => ({ kind: 'table', database: node.database, relation: { ...relation, schema: node.name } }));
}
if (node.kind === 'table') {
	return node.relation.columns.map((column) => ({ kind: 'column', column }));
}
```

(`backupsGroup` returns `[]` for now — Task 7 replaces this one line with the real snapshot query.)

- [ ] **Step 4: Add the preview command**

Add this function above `registerMotherDuck`'s closing `context.subscriptions.push(...)` call (anywhere in the function body, alongside `signIn`/`signOut`):

```js
const PREVIEW_ROWS = 100;

/** @param {string} value */
function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** @param {string} title @param {any[]} rows @param {string} note */
function renderRowsHtml(title, rows, note) {
	const cols = rows.length ? Object.keys(rows[0]) : [];
	const cell = (v) => {
		if (v === null || v === undefined) {
			return '<td class="null">NULL</td>';
		}
		const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
		return `<td>${escapeHtml(text.length > 200 ? `${text.slice(0, 200)}…` : text)}</td>`;
	};
	const table = rows.length === 0
		? '<p class="empty">No rows.</p>'
		: `<table><thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${
			rows.map((r) => `<tr>${cols.map((c) => cell(r[c])).join('')}</tr>`).join('')}</tbody></table>`;
	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 16px 16px; }
h1 { font-size: 1.3em; } small { color: var(--vscode-descriptionForeground); font-weight: normal; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 3px 14px 3px 0; border-bottom: 1px solid var(--vscode-panel-border); white-space: nowrap; }
th { color: var(--vscode-descriptionForeground); font-weight: normal; }
.null { color: var(--vscode-descriptionForeground); font-style: italic; }
.empty { color: var(--vscode-descriptionForeground); }
</style></head><body><h1>${escapeHtml(title)} <small>${escapeHtml(note)}</small></h1>${table}</body></html>`;
}

/** @param {{database: string, relation: {schema: string, table: string}}} node */
async function preview(node) {
	const { database, relation } = node;
	const title = `${database}.${relation.schema}.${relation.table}`;
	try {
		const rows = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Window, title: `MotherDuck: reading ${relation.table}` },
			() => query(`SELECT * FROM ${ident(database)}.${ident(relation.schema)}.${ident(relation.table)} LIMIT ${PREVIEW_ROWS}`),
		);
		const panel = vscode.window.createWebviewPanel('motherduckPreview', `Preview: ${relation.table}`, vscode.ViewColumn.Beside, {});
		panel.webview.html = renderRowsHtml(title, rows, `first ${PREVIEW_ROWS} rows`);
	} catch (err) {
		vscode.window.showErrorMessage(`MotherDuck preview failed: ${err.message}`);
	}
}
```

- [ ] **Step 5: Register the command**

In `context.subscriptions.push(...)`, add:

```js
vscode.commands.registerCommand('motherduckExplorer.preview', preview),
```

- [ ] **Step 6: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 7: Manual check**

Repackage and reinstall (`npx @vscode/vsce package --allow-missing-repository && codium --install-extension vscode-extension-motherduck-0.1.0.vsix --force`), reload the window. Expected: each database expands into "Schemas" and "Backups"; "Schemas" expands into schema names; a schema expands into its tables with row counts; a table expands into its columns with types; clicking a table opens a preview panel with its first 100 rows, natively (no browser tab).

- [ ] **Step 8: Commit**

```bash
git add motherduck.js
git commit -m "feat: add schema/table/column drill-down and row preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Open Dives

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: the `{ kind: 'database', name }` node from Task 4.
- Produces: the `motherduckExplorer.openDives` command.

- [ ] **Step 1: Add the command function**

Add above `registerMotherDuck`'s `context.subscriptions.push(...)` call:

```js
/** @param {{name: string}} node */
async function openDives(node) {
	const url = `https://app.motherduck.com/database/${encodeURIComponent(node.name)}`;
	try {
		await vscode.commands.executeCommand('simpleBrowser.show', url);
	} catch (err) {
		vscode.window.showErrorMessage(`Could not open the embedded browser: ${err.message}`);
	}
}
```

- [ ] **Step 2: Register it**

In `context.subscriptions.push(...)`:

```js
vscode.commands.registerCommand('motherduckExplorer.openDives', openDives),
```

- [ ] **Step 3: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 4: Manual check**

Repackage, reinstall, reload. Click the inline link-external button on a database node. Expected: an embedded "Simple Browser" tab opens inside VS Code showing `app.motherduck.com`, not the system browser. Confirm this is the only action in the extension that opens any browser — clicking through the rest of the tree (schemas, tables, preview) never does.

- [ ] **Step 5: Commit**

```bash
git add motherduck.js
git commit -m "feat: add Open Dives, the extension's only browser action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Backups group

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: `listSnapshotsSql` from `sql.js`, `formatBytes` from `format.js` (first use of `format.js` — add the `require`).
- Produces: node shape `{ kind: 'snapshot', database, snapshotId, createdTs, activeBytes }`, consumed by Task 10's download command.

- [ ] **Step 1: Add the imports**

```js
const { listSnapshotsSql } = require('./sql'); // add to the existing require from './sql'
const { formatBytes, formatDuration } = require('./format');
```

(Merge `listSnapshotsSql` into the single existing `require('./sql')` line rather than adding a second one.)

- [ ] **Step 2: Replace the `backupsGroup` stub in `getChildren`**

Change:

```js
if (node.kind === 'backupsGroup') {
	return [];
}
```

to:

```js
if (node.kind === 'backupsGroup') {
	const rows = await query(listSnapshotsSql(node.database));
	return rows.map((r) => ({ kind: 'snapshot', database: node.database, snapshotId: r.snapshot_id, createdTs: r.created_ts, activeBytes: r.active_bytes }));
}
```

- [ ] **Step 3: Add the `snapshot` case to `getTreeItem`**

Add alongside the other `if` branches, before the final `throw`:

```js
if (node.kind === 'snapshot') {
	const item = new vscode.TreeItem(node.createdTs, vscode.TreeItemCollapsibleState.None);
	item.description = formatBytes(node.activeBytes);
	item.iconPath = new vscode.ThemeIcon('history');
	item.contextValue = 'snapshot';
	return item;
}
```

- [ ] **Step 4: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 5: Manual check**

Repackage, reinstall, reload. Expand a database's "Backups" group. Expected: one row per snapshot, newest first, showing its timestamp and a human-readable size. Expand "Backups" on a database with no snapshots. Expected: it expands to nothing, with no error shown.

- [ ] **Step 6: Commit**

```bash
git add motherduck.js
git commit -m "feat: list database snapshots under Backups

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Download a database's current state

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: `copyDatabaseSql` from `sql.js`, `formatBytes`/`formatDuration` from `format.js` (already imported by Task 7).
- Produces: the `motherduckExplorer.downloadDatabase` command; the `TARGET_ALIAS` constant reused by Tasks 9 and 10.

- [ ] **Step 1: Add the constant and the import**

Add near the top-level constants (alongside `TOKEN_KEY`, `RUN_TIMEOUT_MS`):

```js
const TARGET_ALIAS = 'target_db';
```

Add `copyDatabaseSql` to the existing `require('./sql')` line, and add at the top of the file:

```js
const fs = require('fs');
```

- [ ] **Step 2: Add the command function**

```js
/** @param {{name: string}} node */
async function downloadDatabase(node) {
	if (!(await requireSignIn())) {
		return;
	}
	const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${node.name}.duckdb`), filters: { 'DuckDB database': ['duckdb'] } });
	if (!uri) {
		return;
	}
	const ok = await vscode.window.showWarningMessage(
		`Download "${node.name}" to ${uri.fsPath}?`,
		{ modal: true, detail: "Copies the database's current schema and data to a local file." },
		'Download',
	);
	if (ok !== 'Download') {
		return;
	}
	const started = Date.now();
	try {
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Downloading ${node.name}` },
			() => query(`ATTACH ${sqlString(uri.fsPath)} AS ${ident(TARGET_ALIAS)}; ${copyDatabaseSql(node.name, TARGET_ALIAS)}`),
		);
		const size = formatBytes(fs.statSync(uri.fsPath).size);
		vscode.window.showInformationMessage(`Downloaded ${node.name} (${size}) in ${formatDuration(Date.now() - started)}.`);
	} catch (err) {
		vscode.window.showErrorMessage(`Download failed: ${err.message}`);
	}
}
```

- [ ] **Step 3: Register it**

```js
vscode.commands.registerCommand('motherduckExplorer.downloadDatabase', downloadDatabase),
```

- [ ] **Step 4: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 5: Manual check**

Repackage, reinstall, reload. Right-click a database node, choose "Download Current State", pick a destination, confirm. Expected: a progress notification, then a success message with size and duration; the chosen file opens in the DuckDB CLI (`duckdb <file> -c '.tables'`) and lists the same tables as the source. Cancel the save dialog partway. Expected: nothing runs, no error.

- [ ] **Step 6: Commit**

```bash
git add motherduck.js
git commit -m "feat: download a database's current state to a local file

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Download a single table

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: `copyTableSql` from `sql.js`, `TARGET_ALIAS` from Task 8.
- Produces: the `motherduckExplorer.downloadTable` command.

- [ ] **Step 1: Add `copyTableSql` to the existing `require('./sql')` line**

- [ ] **Step 2: Add the command function**

```js
/** @param {{database: string, relation: {schema: string, table: string}}} node */
async function downloadTable(node) {
	if (!(await requireSignIn())) {
		return;
	}
	const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${node.relation.table}.duckdb`), filters: { 'DuckDB database': ['duckdb'] } });
	if (!uri) {
		return;
	}
	const started = Date.now();
	try {
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Downloading ${node.relation.table}` },
			() => query(`ATTACH ${sqlString(uri.fsPath)} AS ${ident(TARGET_ALIAS)}; ${copyTableSql(node.database, node.relation.schema, node.relation.table, TARGET_ALIAS)}`),
		);
		const size = formatBytes(fs.statSync(uri.fsPath).size);
		vscode.window.showInformationMessage(`Downloaded ${node.relation.table} (${size}) in ${formatDuration(Date.now() - started)}.`);
	} catch (err) {
		vscode.window.showErrorMessage(`Download failed: ${err.message}`);
	}
}
```

- [ ] **Step 3: Register it**

```js
vscode.commands.registerCommand('motherduckExplorer.downloadTable', downloadTable),
```

- [ ] **Step 4: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 5: Manual check**

Repackage, reinstall, reload. Right-click a table node, choose "Download as .duckdb File", pick a destination. Expected: a progress notification, then a success message; the resulting file contains exactly that one table with the same row count as the preview.

- [ ] **Step 6: Commit**

```bash
git add motherduck.js
git commit -m "feat: download a single table to a local file

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Download a snapshot

**Files:**
- Modify: `motherduck.js`

**Interfaces:**
- Consumes: `restoreSnapshotSql`, `copyDatabaseSql`, `dropDatabaseSql` from `sql.js`; `TARGET_ALIAS` from Task 8; the `{ kind: 'snapshot', database, createdTs, ... }` node from Task 7.
- Produces: the `motherduckExplorer.downloadSnapshot` command.

- [ ] **Step 1: Add `restoreSnapshotSql` and `dropDatabaseSql` to the existing `require('./sql')` line**

- [ ] **Step 2: Add the command function**

```js
/** @param {{database: string, createdTs: string}} node */
async function downloadSnapshot(node) {
	if (!(await requireSignIn())) {
		return;
	}
	const tempName = `__md_explorer_restore_${Math.random().toString(36).slice(2, 10)}`;
	const confirmed = await vscode.window.showWarningMessage(
		`Download snapshot from ${node.createdTs}?`,
		{ modal: true, detail: `This temporarily creates a MotherDuck database named "${tempName}" to restore this snapshot, then deletes it.` },
		'Download',
	);
	if (confirmed !== 'Download') {
		return;
	}
	const defaultName = `${node.database}_${node.createdTs.replace(/[: ]/g, '-')}.duckdb`;
	const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultName), filters: { 'DuckDB database': ['duckdb'] } });
	if (!uri) {
		return;
	}
	const started = Date.now();
	try {
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Restoring snapshot from ${node.createdTs}` },
			async () => {
				await query(restoreSnapshotSql(node.database, tempName, node.createdTs));
				try {
					await query(`ATTACH ${sqlString(uri.fsPath)} AS ${ident(TARGET_ALIAS)}; ${copyDatabaseSql(tempName, TARGET_ALIAS)}`);
				} finally {
					try {
						await query(dropDatabaseSql(tempName));
					} catch (dropErr) {
						vscode.window.showErrorMessage(`Could not remove temporary database "${tempName}": ${dropErr.message}`);
					}
				}
			},
		);
		const size = formatBytes(fs.statSync(uri.fsPath).size);
		vscode.window.showInformationMessage(`Downloaded snapshot (${size}) in ${formatDuration(Date.now() - started)}.`);
	} catch (err) {
		vscode.window.showErrorMessage(`Snapshot download failed: ${err.message}`);
	}
}
```

Note the ordering: the temporary database is created only after both the confirm dialog and the save dialog have been accepted, so cancelling either one creates nothing to clean up. The `finally` around the copy step drops the temporary database whether the copy succeeds or throws.

- [ ] **Step 3: Register it**

```js
vscode.commands.registerCommand('motherduckExplorer.downloadSnapshot', downloadSnapshot),
```

- [ ] **Step 4: Verify syntax**

Run: `node --check motherduck.js && echo ok`
Expected: `ok`

- [ ] **Step 5: Manual check**

Repackage, reinstall, reload. Click a snapshot's inline download button, confirm, pick a destination. Expected: a progress notification, a success message, and a valid local file with that snapshot's data. Immediately after, check `SELECT name FROM md_information_schema.databases` (e.g. through the tree's Refresh) — the temporary `__md_explorer_restore_*` database must be gone. Repeat, but click "Cancel" on the confirm dialog — expected: no temporary database appears at all. Repeat again, confirm, then cancel the save dialog — same expectation.

- [ ] **Step 6: Commit**

```bash
git add motherduck.js
git commit -m "feat: download a snapshot, restoring and cleaning up a temp database

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: README and full manual verification pass

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the real README**

```markdown
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
```

- [ ] **Step 2: Commit the README**

```bash
git add README.md
git commit -m "docs: write the real README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Run the unit tests**

Run: `npm test`
Expected: both `sql.test.js` and `format.test.js` print `ok`.

- [ ] **Step 4: Package**

Run: `npx @vscode/vsce package --allow-missing-repository`
Expected: `vscode-extension-motherduck-0.1.0.vsix` is written with no errors.

- [ ] **Step 5: Full manual pass against a real account**

Install the `.vsix`, reload, and walk every item in the spec's Scope section end to end: sign in/out, the full database → schema → table → column tree, table preview, Open Dives (embedded browser, nothing else ever opens one), the Backups group, and all three downloads (database, table, snapshot — including the snapshot cancellation cases from Task 10). Note anything that doesn't match the spec.

- [ ] **Step 6: Final commit if anything changed during the manual pass**

```bash
git add -A
git commit -m "fix: address issues found in manual verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Skip this commit if the manual pass found nothing to fix.)
