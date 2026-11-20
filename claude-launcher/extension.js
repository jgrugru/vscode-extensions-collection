const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { buildArgs, buildEnv, toShell } = require('./flags');
const { discover, listMcp } = require('./discover');
const { measure } = require('./measure');
const { page } = require('./page');

function exe() {
	return vscode.workspace.getConfiguration('claudeLauncher').get('executablePath') || 'claude';
}

/** Adds the bundled skill plugins for the chosen chat type and project type. */
function withChat(context, state) {
	const dirs = [];
	if (state.chatType) dirs.push(context.asAbsolutePath(`chat-plugins/${state.chatType}`));
	return dirs.length ? { ...state, pluginDirs: dirs } : state;
}

function workspace() {
	const f = vscode.workspace.workspaceFolders;
	return f && f[0] ? f[0].uri.fsPath : undefined;
}

/** Session folder: the first chosen folder, else the workspace. */
function cwdFor(state) {
	const f = state && state.folderAccess && state.folderAccess[0];
	return f ? (f.file ? path.dirname(f.path) : f.path) : workspace();
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('claudeLauncher.start', {
			async resolveWebviewView(view) {
				view.webview.options = { enableScripts: true };
				const found = await discover(workspace());
				found.root = workspace();
							const nonce = Math.random().toString(36).slice(2);
				view.webview.html = page(nonce, found);
				const mcpCost = async (key) => {
					try {
						const all = await measure(exe(), {}, workspace());
						const none = await measure(exe(), { mcpMode: 'none' }, workspace());
						const tokens = Math.max(0, all.total - none.total);
						if (key) await context.globalState.update(key, tokens);
						view.webview.postMessage({ type: 'mcpCost', tokens });
					} catch (err) {
						view.webview.postMessage({ type: 'mcpCost', error: err.message });
					}
				};
				// Listing servers is slow, so show the saved list at once and refresh it in the background.
				const listKey = 'mcpList:' + workspace();
				const measuring = new Set();
				const showMcp = (servers) => {
					view.webview.postMessage({ type: 'mcpList', servers });
					if (!servers.length) return;
					// Measure once per server set, then reuse the saved number.
					const key = 'mcpCost:' + servers.map((s) => s.name).sort().join(',');
					const cached = context.globalState.get(key);
					if (cached !== undefined) view.webview.postMessage({ type: 'mcpCost', tokens: cached });
					else if (!measuring.has(key)) { measuring.add(key); mcpCost(key).finally(() => measuring.delete(key)); }
				};
				const savedList = context.globalState.get(listKey);
				if (savedList) showMcp(savedList);
				listMcp(exe(), workspace()).then(async (servers) => {
					await context.globalState.update(listKey, servers);
					showMcp(servers);
				});
				view.webview.onDidReceiveMessage(async (m) => {
					if (m.type === 'mcpCost') { await mcpCost(); return; }
					if (m.type === 'listDir') {
						let entries = [];
						try {
							const raw = await fs.promises.readdir(m.path || workspace(), { withFileTypes: true });
							entries = raw
								.filter((e) => e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.DS_Store')
								.map((e) => ({ name: e.name, path: path.join(m.path || workspace(), e.name), dir: e.isDirectory() }))
								.sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name));
						} catch {}
						view.webview.postMessage({ type: 'dir', path: m.path, entries });
						return;
					}
					if (m.type === 'pickFolder') {
						const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: true, defaultUri: vscode.Uri.file(workspace() || '/') });
						if (picked) view.webview.postMessage({ type: 'picked', paths: picked.map((u) => u.fsPath) });
						return;
					}
					const cmd = toShell(exe(), buildArgs(withChat(context, m.state || {})), buildEnv(m.state || {}));
					if (m.type === 'update') view.webview.postMessage({ type: 'command', text: cmd });
					if (m.type === 'copy') {
						await vscode.env.clipboard.writeText(cmd);
						vscode.window.showInformationMessage('Command copied');
					}
					if (m.type === 'launch') {
						const t = vscode.window.createTerminal({ name: 'Claude', cwd: cwdFor(m.state), location: vscode.TerminalLocation.Editor });
						t.show();
						t.sendText(cmd);
					}
					if (m.type === 'measure') {
						try {
							const r = await measure(exe(), withChat(context, m.state || {}), cwdFor(m.state));
							view.webview.postMessage({ type: 'measure', label: m.label, ...r });
						} catch (e) {
							view.webview.postMessage({ type: 'measure', error: e.message });
						}
					}
				});
			},
		}),
		vscode.commands.registerCommand('claudeLauncher.open', () => vscode.commands.executeCommand('claudeLauncher.start.focus'))
	);
}

function deactivate() {}

module.exports = { activate, deactivate };
