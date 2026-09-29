const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { findPipeline, buildCommand } = require('./pipelines');

const TASK_TYPE = 'dltPipeline';
const EXCLUDE = '{**/.venv/**,**/venv/**,**/node_modules/**,**/site-packages/**}';

/** @param {number} ms */
function formatDuration(ms) {
	const s = ms / 1000;
	return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
	const changed = new vscode.EventEmitter();
	/** @type {{uri: vscode.Uri, name: string | undefined}[]} */
	let pipelines = [];
	/** @type {Map<string, {status: 'running' | 'succeeded' | 'failed' | 'stopped', startedAt: number, durationMs?: number, exitCode?: number, execution?: vscode.TaskExecution, stopRequested?: boolean}>} */
	const runs = new Map();

	async function scan() {
		const files = await vscode.workspace.findFiles('**/*.py', EXCLUDE);
		const found = [];
		for (const uri of files) {
			try {
				const text = await fs.promises.readFile(uri.fsPath, 'utf8');
				const pipeline = findPipeline(text);
				if (pipeline) {
					found.push({ uri, name: pipeline.name });
				}
			} catch {
				// Unreadable file: skip it.
			}
		}
		pipelines = found.sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath));
		changed.fire(undefined);
	}

	function describe(node) {
		const folder = vscode.workspace.getWorkspaceFolder(node.uri);
		const relative = folder ? path.relative(folder.uri.fsPath, node.uri.fsPath) : node.uri.fsPath;
		const run = runs.get(node.uri.fsPath);
		const status = {
			running: 'running',
			succeeded: run && `succeeded in ${formatDuration(run.durationMs ?? 0)}`,
			failed: run && `failed, exit code ${run.exitCode}`,
			stopped: 'stopped',
		}[run?.status ?? ''];
		return status ? `${relative}  ·  ${status}` : relative;
	}

	const icons = {
		running: new vscode.ThemeIcon('sync~spin'),
		succeeded: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')),
		failed: new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')),
		stopped: new vscode.ThemeIcon('debug-stop'),
	};

	/** @implements {vscode.TreeDataProvider<any>} */
	const provider = {
		onDidChangeTreeData: changed.event,
		getTreeItem(node) {
			const run = runs.get(node.uri.fsPath);
			const item = new vscode.TreeItem(node.name || path.basename(node.uri.fsPath));
			item.description = describe(node);
			item.tooltip = node.uri.fsPath;
			item.iconPath = (run && icons[run.status]) || new vscode.ThemeIcon('circle-outline');
			item.contextValue = run?.status === 'running' ? 'dltPipeline.running' : 'dltPipeline.idle';
			item.command = { command: 'vscode.open', title: 'Open Source', arguments: [node.uri] };
			return item;
		},
		getChildren(node) {
			return node ? [] : pipelines;
		},
	};

	/** @param {{uri: vscode.Uri}} node */
	async function run(node) {
		const file = node?.uri?.fsPath;
		const folder = file && vscode.workspace.getWorkspaceFolder(node.uri);
		if (!folder) {
			return;
		}
		if (runs.get(file)?.status === 'running') {
			return;
		}
		const root = folder.uri.fsPath;
		const command = buildCommand({
			file,
			root,
			setting: vscode.workspace.getConfiguration('dltPipelines').get('runCommand') || '',
			hasUv: fs.existsSync(path.join(root, 'uv.lock')),
		});
		const label = node.name || path.basename(file);
		const task = new vscode.Task({ type: TASK_TYPE, file }, folder, label, 'dlt', new vscode.ShellExecution(command, { cwd: root }));
		task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated, clear: true };
		try {
			const execution = await vscode.tasks.executeTask(task);
			const state = runs.get(file);
			if (state?.status === 'running') {
				state.execution = execution;
			} else {
				runs.set(file, { status: 'running', startedAt: Date.now(), execution });
			}
			changed.fire(undefined);
		} catch (err) {
			vscode.window.showErrorMessage(`Could not start ${label}: ${err.message}`);
		}
	}

	/** @param {{uri: vscode.Uri}} node */
	function stop(node) {
		const state = runs.get(node?.uri?.fsPath);
		if (state?.status === 'running' && state.execution) {
			state.stopRequested = true;
			state.execution.terminate();
		}
	}

	const fileOf = (execution) => (execution.task.definition.type === TASK_TYPE ? execution.task.definition.file : undefined);

	context.subscriptions.push(
		vscode.window.createTreeView('dltPipelines.pipelines', { treeDataProvider: provider }),
		vscode.commands.registerCommand('dltPipelines.run', run),
		vscode.commands.registerCommand('dltPipelines.stop', stop),
		vscode.commands.registerCommand('dltPipelines.refresh', scan),
		vscode.tasks.onDidStartTaskProcess((e) => {
			const file = fileOf(e.execution);
			if (file) {
				runs.set(file, { status: 'running', startedAt: Date.now(), execution: e.execution, stopRequested: runs.get(file)?.stopRequested });
				changed.fire(undefined);
			}
		}),
		vscode.tasks.onDidEndTaskProcess((e) => {
			const file = fileOf(e.execution);
			const state = file && runs.get(file);
			if (!state) {
				return;
			}
			state.durationMs = Date.now() - state.startedAt;
			state.exitCode = e.exitCode;
			state.execution = undefined;
			state.status = state.stopRequested || e.exitCode === undefined ? 'stopped' : e.exitCode === 0 ? 'succeeded' : 'failed';
			state.stopRequested = false;
			changed.fire(undefined);
		}),
		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (doc.languageId === 'python') {
				scan();
			}
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(scan),
	);

	scan();
}

function deactivate() {}

module.exports = { activate, deactivate };
