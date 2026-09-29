const net = require('net');
const path = require('path');
const vscode = require('vscode');
const { startFramingProxy } = require('./proxy');
const { sqlString } = require('./sql');
const { registerMotherDuck } = require('./motherduck');
const { readDatabaseSchema, readDataFileSchema, renderSchemaHtml } = require('./schema');

/** DuckDB reader function per data file extension. Other extensions are treated as database files. */
const DATA_READERS = {
	'.csv': 'read_csv',
	'.tsv': 'read_csv',
	'.parquet': 'read_parquet',
	'.json': 'read_json_auto',
	'.jsonl': 'read_json_auto',
	'.ndjson': 'read_json_auto',
	'.xlsx': 'read_xlsx',
};

/** @type {Map<number, import('http').Server>} */
const proxies = new Map();

/**
 * Quote a value so the terminal shell treats it as one argument.
 * @param {string} value
 */
function quote(value) {
	if (process.platform === 'win32') {
		return `"${value}"`;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** @param {string} file */
function dataReader(file) {
	return DATA_READERS[path.extname(file).toLowerCase()];
}

/** SQL that reads a data file, or undefined for a database file. @param {string} file */
function dataRelationSql(file) {
	const reader = dataReader(file);
	return reader && `${reader}(${sqlString(file)})`;
}

/** @returns {string} */
function executable() {
	return vscode.workspace.getConfiguration('duckdbTerminal').get('executablePath') || 'duckdb';
}

/**
 * Open a new integrated terminal in the file's folder and run duckdb on it.
 * A database file is opened directly. A data file is exposed as a view named `data` in a fresh in-memory database.
 * @param {vscode.Uri | undefined} uri
 * @param {string[]} flags
 * @param {string} label
 * @param {string} [setupSql] SQL to run before the UI server starts
 */
function launch(uri, flags, label, setupSql = '') {
	if (!uri || uri.scheme !== 'file') {
		vscode.window.showErrorMessage('Right-click a DuckDB file in the Explorer to use this command.');
		return;
	}

	const file = uri.fsPath;
	const relation = dataRelationSql(file);
	const args = [...flags];
	const init = [relation && `CREATE VIEW data AS SELECT * FROM ${relation};`, setupSql].filter(Boolean).join(' ');
	if (init) {
		args.push('-cmd', quote(init));
	}
	if (!relation) {
		args.push(quote(file));
	}
	const terminal = vscode.window.createTerminal({
		name: `${label}: ${path.basename(file)}`,
		cwd: path.dirname(file),
	});
	terminal.show();
	terminal.sendText([quote(executable()), ...args].join(' '), true);
}

/**
 * Show tables, views and columns in a panel. The file is opened read-only for the length of one
 * query, so nothing stays attached.
 * @param {vscode.Uri | undefined} uri
 */
async function showSchema(uri) {
	if (!uri || uri.scheme !== 'file') {
		vscode.window.showErrorMessage('Right-click a DuckDB file in the Explorer to use this command.');
		return;
	}
	const file = uri.fsPath;
	const name = path.basename(file);
	const relation = dataRelationSql(file);
	try {
		const relations = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Window, title: `DuckDB: reading ${name}` },
			() => (relation ? readDataFileSchema(executable(), relation) : readDatabaseSchema(executable(), file)),
		);
		const panel = vscode.window.createWebviewPanel('duckdbSchema', `Schema: ${name}`, vscode.ViewColumn.Beside, {});
		panel.webview.html = renderSchemaHtml(name, relations);
	} catch (err) {
		vscode.window.showErrorMessage(`DuckDB could not read ${name}: ${err.message}`);
	}
}

/**
 * Resolve true once something listens on the port, false after the timeout.
 * @param {number} port
 * @param {number} timeoutMs
 */
async function waitForPort(port, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const open = await new Promise((resolve) => {
			const socket = net.connect(port, 'localhost');
			socket.once('connect', () => { socket.destroy(); resolve(true); });
			socket.once('error', () => resolve(false));
		});
		if (open) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	return false;
}

/**
 * Start the DuckDB UI server in a terminal, then show the UI in an editor tab.
 * `start_ui_server()` does not launch the system browser, unlike the CLI `-ui` flag.
 * @param {vscode.Uri | undefined} uri
 */
async function openUi(uri) {
	// The UI page only authenticates as "local" when served from http://localhost:<uiPort>, so the proxy
	// that strips the framing headers takes that port and DuckDB itself listens on the next one.
	const port = vscode.workspace.getConfiguration('duckdbTerminal').get('uiPort') || 4213;
	const serverPort = port + 1;
	launch(uri, [], 'DuckDB UI', `SET ui_local_port=${serverPort}; CALL start_ui_server();`);
	if (!(await waitForPort(serverPort, 15000))) {
		vscode.window.showErrorMessage(`DuckDB UI server did not start on port ${serverPort}. Check the terminal.`);
		return;
	}
	// Simple Browser cannot embed the UI as served (X-Frame-Options); the integrated browser command
	// does nothing in some builds.
	if (!proxies.has(port)) {
		try {
			proxies.set(port, await startFramingProxy(serverPort, port));
		} catch (err) {
			vscode.window.showErrorMessage(`Cannot listen on port ${port} (${err.code || err}). Change duckdbTerminal.uiPort.`);
			return;
		}
	}
	await vscode.commands.executeCommand('simpleBrowser.show', `http://localhost:${port}/`);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(
		vscode.commands.registerCommand('duckdbTerminal.openUi', openUi),
		vscode.commands.registerCommand('duckdbTerminal.openShell', (uri) => launch(uri, [], 'DuckDB')),
		vscode.commands.registerCommand('duckdbTerminal.showSchema', showSchema),
	);
	registerMotherDuck(context, { executable, dataRelationSql });
}

function deactivate() {
	for (const proxy of proxies.values()) {
		proxy.close();
	}
	proxies.clear();
}

module.exports = {
	activate,
	deactivate,
};
