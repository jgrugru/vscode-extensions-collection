const fs = require('fs');
const vscode = require('vscode');
const { execFile } = require('child_process');
const { schemaSql, groupSchemaRows, listSnapshotsSql, copyDatabaseSql, copyTableSql, ident, sqlString } = require('./sql');
const { formatBytes, formatDuration } = require('./format');

const TOKEN_KEY = 'motherduck_token';
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const TARGET_ALIAS = 'target_db';

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

	/** @implements {vscode.TreeDataProvider<any>} */
	const provider = {
		onDidChangeTreeData: changed.event,

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
			if (node.kind === 'snapshot') {
				const item = new vscode.TreeItem(node.createdTs, vscode.TreeItemCollapsibleState.None);
				item.description = formatBytes(node.activeBytes);
				item.iconPath = new vscode.ThemeIcon('history');
				item.contextValue = 'snapshot';
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

		async getChildren(node) {
			if (!(await token())) {
				return [];
			}
			try {
				if (!node) {
					return (await query('SELECT name FROM md_information_schema.databases ORDER BY name'))
						.map((r) => ({ kind: 'database', name: r.name }));
				}
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
					const rows = await query(listSnapshotsSql(node.database));
					return rows.map((r) => ({ kind: 'snapshot', database: node.database, snapshotId: r.snapshot_id, createdTs: r.created_ts, activeBytes: r.active_bytes }));
				}
				if (node.kind === 'schema') {
					return node.tables.map((relation) => ({ kind: 'table', database: node.database, relation: { ...relation, schema: node.name } }));
				}
				if (node.kind === 'table') {
					return node.relation.columns.map((column) => ({ kind: 'column', column }));
				}
			} catch (err) {
				vscode.window.showErrorMessage(`MotherDuck: ${err.message}`);
			}
			return [];
		},
	};

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

	/** @param {{name: string}} node */
	async function openDives(node) {
		const url = `https://app.motherduck.com/database/${encodeURIComponent(node.name)}`;
		try {
			await vscode.commands.executeCommand('simpleBrowser.show', url);
		} catch (err) {
			vscode.window.showErrorMessage(`Could not open the embedded browser: ${err.message}`);
		}
	}

	updateSignedIn();
	context.subscriptions.push(
		changed,
		vscode.window.registerTreeDataProvider('motherduckExplorer.databases', provider),
		vscode.commands.registerCommand('motherduckExplorer.signIn', signIn),
		vscode.commands.registerCommand('motherduckExplorer.signOut', signOut),
		vscode.commands.registerCommand('motherduckExplorer.refresh', () => changed.fire(undefined)),
		vscode.commands.registerCommand('motherduckExplorer.preview', preview),
		vscode.commands.registerCommand('motherduckExplorer.openDives', openDives),
		vscode.commands.registerCommand('motherduckExplorer.downloadDatabase', downloadDatabase),
		vscode.commands.registerCommand('motherduckExplorer.downloadTable', downloadTable),
	);
}

module.exports = { registerMotherDuck };
