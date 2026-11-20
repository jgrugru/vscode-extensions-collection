const vscode = require('vscode');
const path = require('path');
const { describe, measure, newTotals } = require('./size');

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('measureSize.measure', async (clicked, selected) => {
      // The Explorer passes the clicked item, then the whole selection.
      const uris = (selected && selected.length > 0 ? selected : [clicked]).filter(Boolean);
      if (uris.length === 0) return;
      const name = uris.length === 1 ? path.basename(uris[0].fsPath) : `${uris.length} items`;

      const totals = newTotals();
      const cancelled = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Measuring ${name}...`, cancellable: true },
        async (_progress, token) => {
          for (const uri of uris) {
            await measure(uri.fsPath, () => token.isCancellationRequested, totals);
          }
          return token.isCancellationRequested;
        }
      );
      if (cancelled) return;

      const message = describe(name, totals);
      const choice = await vscode.window.showInformationMessage(message, 'Copy');
      if (choice === 'Copy') await vscode.env.clipboard.writeText(message);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
