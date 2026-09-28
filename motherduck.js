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
