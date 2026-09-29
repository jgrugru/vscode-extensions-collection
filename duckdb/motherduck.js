const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { runJson, schemaSql, renderRowsHtml } = require('./schema');
const { sqlString, ident, uploadDataSql, listTablesSql, copyTablesSql } = require('./sql');

const TOKEN_KEY = 'motherduck_token';
const SHARE_ALIAS = 'shared_db';
const PREVIEW_ROWS = 100;
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const SOURCE_ALIAS = 'upload_source';
const NEW_DATABASE = 'New database…';
const NEW_SCHEMA = 'New schema…';

/**
 * Connects to MotherDuck through the DuckDB CLI. The CLI opens a browser sign-in and waits when no
 * token is set, so every call goes through `run`, which refuses to start without one.
 * @param {vscode.ExtensionContext} context
 * @param {{executable: () => string, dataRelationSql: (file: string) => string | undefined}} host
 */
function registerMotherDuck(context, host) {
	const changed = new vscode.EventEmitter();

	async function token() {
		return (await context.secrets.get(TOKEN_KEY)) || process.env.motherduck_token || process.env.MOTHERDUCK_TOKEN || '';
	}

	async function updateSignedIn() {
		await vscode.commands.executeCommand('setContext', 'duckdbTerminal.mdSignedIn', Boolean(await token()));
	}

	/**
	 * @param {string} sql
	 * @param {{setup?: string, timeout?: number}} [options]
	 */
	async function run(sql, options = {}) {
		const value = await token();
		if (!value) {
			throw new Error('Not signed in to MotherDuck.');
		}
		const args = ['md:'];
		if (options.setup) {
			args.push('-cmd', options.setup);
		}
		args.push('-c', sql);
		return runJson(host.executable(), args, { env: { motherduck_token: value }, timeout: options.timeout });
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

	/** @param {string} database @param {string} [shareUrl] */
	function scope(database, shareUrl) {
		return shareUrl
			? { name: SHARE_ALIAS, setup: `ATTACH ${sqlString(shareUrl)} AS ${SHARE_ALIAS} (READ_ONLY)` }
			: { name: database, setup: undefined };
	}

	/** @param {{name: string, setup?: string}} s */
	async function readRelations(s) {
		const rows = await run(schemaSql(sqlString(s.name)), { setup: s.setup });
		const relations = new Map();
		for (const row of rows) {
			const key = `${row.schema_name}\u0000${row.table_name}`;
			if (!relations.has(key)) {
				relations.set(key, { schema: row.schema_name, table: row.table_name, kind: row.kind, rows: row.row_count, columns: [] });
			}
			relations.get(key).columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable });
		}
		return [...relations.values()];
	}

	/** @param {any} node */
	async function preview(node) {
		const { database, shareUrl, relation } = node;
		const s = scope(database, shareUrl);
		const title = `${database}.${relation.schema}.${relation.table}`;
		try {
			const rows = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Window, title: `MotherDuck: reading ${relation.table}` },
				() => run(`SELECT * FROM ${ident(s.name)}.${ident(relation.schema)}.${ident(relation.table)} LIMIT ${PREVIEW_ROWS}`, { setup: s.setup }),
			);
			const panel = vscode.window.createWebviewPanel('duckdbPreview', `Preview: ${relation.table}`, vscode.ViewColumn.Beside, {});
			panel.webview.html = renderRowsHtml(title, rows, `first ${PREVIEW_ROWS} rows`);
		} catch (err) {
			vscode.window.showErrorMessage(`MotherDuck preview failed: ${err.message}`);
		}
	}

	/** @param {any} node */
	async function createShare(node) {
		if (!(await requireSignIn())) {
			return;
		}
		const name = await vscode.window.showInputBox({ title: 'Share name', value: `${node.name}_share`, ignoreFocusOut: true });
		if (!name) {
			return;
		}
		const access = await vscode.window.showQuickPick([
			{ label: 'ORGANIZATION', description: 'Members of your MotherDuck organization' },
			{ label: 'RESTRICTED', description: 'Only users you grant access to' },
			{ label: 'UNRESTRICTED', description: 'Anyone with the share URL can attach it' },
		], { title: 'Who can attach this share?', ignoreFocusOut: true });
		if (!access) {
			return;
		}
		const visibility = await vscode.window.showQuickPick([
			{ label: 'DISCOVERABLE', description: 'Listed for people who have access' },
			{ label: 'HIDDEN', description: 'Only people you give the URL to' },
		], { title: 'Visibility', ignoreFocusOut: true });
		if (!visibility) {
			return;
		}
		const ok = await vscode.window.showWarningMessage(
			`Create share "${name}" from database "${node.name}"?`,
			{ modal: true, detail: `Access: ${access.label}. Visibility: ${visibility.label}. The share shows the database's current contents to anyone with access.` },
			'Create Share',
		);
		if (ok !== 'Create Share') {
			return;
		}
		try {
			const rows = await run(`CREATE SHARE ${ident(name)} FROM ${ident(node.name)} (ACCESS ${access.label}, VISIBILITY ${visibility.label})`);
			const url = Object.values(rows[0] || {}).find((v) => typeof v === 'string' && v.startsWith('md:'));
			changed.fire(undefined);
			if (url) {
				const copy = await vscode.window.showInformationMessage(`Share created: ${url}`, 'Copy URL');
				if (copy) {
					await vscode.env.clipboard.writeText(url);
				}
			} else {
				vscode.window.showInformationMessage(`Share "${name}" created.`);
			}
		} catch (err) {
			vscode.window.showErrorMessage(`Could not create share: ${err.message}`);
		}
	}

	/** @param {string} title @param {string} value */
	function askName(title, value) {
		return vscode.window.showInputBox({ title, value, validateInput: (v) => (v.trim() ? undefined : 'A name is required'), ignoreFocusOut: true });
	}

	/**
	 * Ask where an upload goes: database, schema and, for a data file, the table name.
	 * @param {{table?: string, allowNewDatabase: boolean}} options
	 * @returns {Promise<{database: string, newDatabase: boolean, schema: string, table: string} | undefined>}
	 */
	async function pickDestination({ table, allowNewDatabase }) {
		let databases;
		try {
			databases = (await run('SELECT name FROM md_information_schema.databases ORDER BY name')).map((d) => d.name);
		} catch (err) {
			vscode.window.showErrorMessage(`Could not list MotherDuck databases: ${err.message}`);
			return undefined;
		}
		const items = databases.map((label) => ({ label }));
		if (allowNewDatabase) {
			items.push({ label: '', kind: vscode.QuickPickItemKind.Separator }, { label: NEW_DATABASE });
		}
		const db = await vscode.window.showQuickPick(items, { title: 'Upload to which database?', ignoreFocusOut: true });
		if (!db) {
			return undefined;
		}
		const newDatabase = db.label === NEW_DATABASE;
		const database = newDatabase ? await askName('New MotherDuck database name', table) : db.label;
		if (!database) {
			return undefined;
		}

		let schema = 'main';
		if (newDatabase) {
			schema = await askName('Schema name', 'main');
		} else {
			let schemas;
			try {
				schemas = (await run(`SELECT schema_name FROM information_schema.schemata WHERE catalog_name = ${sqlString(database)} AND schema_name NOT IN ('information_schema', 'pg_catalog') ORDER BY schema_name = 'main' DESC, schema_name`)).map((r) => r.schema_name);
			} catch (err) {
				vscode.window.showErrorMessage(`Could not list schemas in ${database}: ${err.message}`);
				return undefined;
			}
			const pick = await vscode.window.showQuickPick(
				[...schemas.map((label) => ({ label })), { label: '', kind: vscode.QuickPickItemKind.Separator }, { label: NEW_SCHEMA }],
				{ title: `Schema in ${database}`, ignoreFocusOut: true },
			);
			schema = pick && (pick.label === NEW_SCHEMA ? await askName('New schema name', '') : pick.label);
		}
		if (!schema) {
			return undefined;
		}

		const name = table === undefined ? '' : await askName('Table name', table);
		return name === undefined ? undefined : { database, newDatabase, schema, table: name };
	}

	/** @param {vscode.Uri | undefined} uri */
	async function upload(uri) {
		if (!uri || uri.scheme !== 'file') {
			vscode.window.showErrorMessage('Right-click a DuckDB or data file in the Explorer to use this command.');
			return;
		}
		if (!(await requireSignIn())) {
			return;
		}
		const file = uri.fsPath;
		const base = path.basename(file);
		const stem = path.basename(file, path.extname(file)).replace(/[^A-Za-z0-9_]/g, '_');
		const relation = host.dataRelationSql(file);
		const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);

		let sql;
		let setup;
		let summary;
		if (relation) {
			const dest = await pickDestination({ table: stem, allowNewDatabase: true });
			if (!dest) {
				return;
			}
			sql = uploadDataSql({ ...dest, relation });
			summary = `Load ${base} (${mb} MB) into ${dest.newDatabase ? 'new ' : ''}table "${dest.database}.${dest.schema}.${dest.table}"?`;
		} else {
			const mode = await vscode.window.showQuickPick(
				[
					{ label: 'New database', description: 'the whole file becomes one MotherDuck database', existing: false },
					{ label: 'Existing database', description: 'copy its tables into a database and schema you pick', existing: true },
				],
				{ title: `Upload ${base} as`, ignoreFocusOut: true },
			);
			if (!mode) {
				return;
			}
			if (!mode.existing) {
				const name = await askName('New MotherDuck database name', stem);
				if (!name) {
					return;
				}
				sql = `CREATE DATABASE ${ident(name)} FROM ${sqlString(file)}`;
				summary = `Upload ${base} (${mb} MB) as new MotherDuck database "${name}"?`;
			} else {
				const dest = await pickDestination({ allowNewDatabase: false });
				if (!dest) {
					return;
				}
				setup = `ATTACH ${sqlString(file)} AS ${SOURCE_ALIAS} (READ_ONLY)`;
				let tables;
				try {
					tables = await run(listTablesSql(SOURCE_ALIAS), { setup });
				} catch (err) {
					vscode.window.showErrorMessage(`Could not read tables in ${base}: ${err.message}`);
					return;
				}
				if (!tables.length) {
					vscode.window.showErrorMessage(`${base} has no tables to copy.`);
					return;
				}
				sql = copyTablesSql({ database: dest.database, schema: dest.schema, source: SOURCE_ALIAS, tables });
				summary = `Copy ${tables.length} table${tables.length === 1 ? '' : 's'} from ${base} (${mb} MB) into "${dest.database}.${dest.schema}"?`;
			}
		}

		const ok = await vscode.window.showWarningMessage(summary, { modal: true, detail: 'This writes to MotherDuck. It fails if a name already exists.' }, 'Upload');
		if (ok !== 'Upload') {
			return;
		}
		try {
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Uploading ${base} to MotherDuck` },
				() => run(sql, { setup, timeout: UPLOAD_TIMEOUT_MS }),
			);
			changed.fire(undefined);
			vscode.window.showInformationMessage(`Uploaded ${base} to MotherDuck.`);
		} catch (err) {
			vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
		}
	}

	/** @implements {vscode.TreeDataProvider<any>} */
	const provider = {
		onDidChangeTreeData: changed.event,

		getTreeItem(node) {
			const Collapsed = vscode.TreeItemCollapsibleState.Collapsed;
			const None = vscode.TreeItemCollapsibleState.None;
			switch (node.kind) {
				case 'group': {
					const item = new vscode.TreeItem(node.label, Collapsed);
					item.contextValue = 'group';
					return item;
				}
				case 'db': {
					const item = new vscode.TreeItem(node.name, Collapsed);
					item.iconPath = new vscode.ThemeIcon('database');
					item.contextValue = 'db';
					return item;
				}
				case 'shared': {
					const item = new vscode.TreeItem(node.name, Collapsed);
					item.description = node.owner;
					item.iconPath = new vscode.ThemeIcon('link');
					item.contextValue = 'sharedDb';
					item.tooltip = node.url;
					return item;
				}
				case 'share': {
					const item = new vscode.TreeItem(node.name, None);
					item.description = [node.access, node.visibility].filter(Boolean).join(' · ');
					item.iconPath = new vscode.ThemeIcon('link');
					item.contextValue = 'share';
					item.tooltip = node.url;
					return item;
				}
				case 'relation': {
					const r = node.relation;
					const label = r.schema === 'main' ? r.table : `${r.schema}.${r.table}`;
					const item = new vscode.TreeItem(label, Collapsed);
					item.description = [r.kind, r.rows != null ? `${r.rows.toLocaleString()} rows` : null].filter(Boolean).join(' · ');
					item.iconPath = new vscode.ThemeIcon(r.kind === 'view' ? 'eye' : 'table');
					item.contextValue = 'relation';
					item.command = { command: 'duckdbTerminal.motherduckPreview', title: 'Preview', arguments: [node] };
					return item;
				}
				default: {
					const item = new vscode.TreeItem(node.column.name, None);
					item.description = `${node.column.type}${node.column.nullable ? '' : ' · NOT NULL'}`;
					item.iconPath = new vscode.ThemeIcon('symbol-field');
					return item;
				}
			}
		},

		async getChildren(node) {
			if (!(await token())) {
				return [];
			}
			try {
				if (!node) {
					return [
						{ kind: 'group', id: 'dbs', label: 'Databases' },
						{ kind: 'group', id: 'shared', label: 'Shared with me' },
						{ kind: 'group', id: 'owned', label: 'My shares' },
					];
				}
				if (node.kind === 'group' && node.id === 'dbs') {
					return (await run('SELECT name FROM md_information_schema.databases ORDER BY name')).map((r) => ({ kind: 'db', name: r.name }));
				}
				if (node.kind === 'group' && node.id === 'shared') {
					return (await run('SELECT name, url, owner FROM md_information_schema.shared_with_me ORDER BY name'))
						.map((r) => ({ kind: 'shared', name: r.name, url: r.url, owner: r.owner }));
				}
				if (node.kind === 'group') {
					return (await run('SELECT name, url, access, visibility FROM md_information_schema.owned_shares ORDER BY name'))
						.map((r) => ({ kind: 'share', name: r.name, url: r.url, access: r.access, visibility: r.visibility }));
				}
				if (node.kind === 'db' || node.kind === 'shared') {
					const s = scope(node.name, node.kind === 'shared' ? node.url : undefined);
					return (await readRelations(s)).map((relation) => ({
						kind: 'relation', database: node.name, shareUrl: node.kind === 'shared' ? node.url : undefined, relation,
					}));
				}
				if (node.kind === 'relation') {
					return node.relation.columns.map((column) => ({ kind: 'column', column }));
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
		vscode.window.registerTreeDataProvider('duckdbTerminal.motherduck', provider),
		vscode.commands.registerCommand('duckdbTerminal.motherduckSignIn', signIn),
		vscode.commands.registerCommand('duckdbTerminal.motherduckSignOut', signOut),
		vscode.commands.registerCommand('duckdbTerminal.motherduckRefresh', () => changed.fire(undefined)),
		vscode.commands.registerCommand('duckdbTerminal.motherduckPreview', preview),
		vscode.commands.registerCommand('duckdbTerminal.motherduckCreateShare', createShare),
		vscode.commands.registerCommand('duckdbTerminal.motherduckCopyShareUrl', (node) => vscode.env.clipboard.writeText(node.url)),
		vscode.commands.registerCommand('duckdbTerminal.uploadToMotherDuck', upload),
	);
}

module.exports = { registerMotherDuck };
