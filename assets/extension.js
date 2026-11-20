const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { kindMap, extOf, walk, ffmpegCandidates } = require('./assets');
const { createThumbnailer } = require('./thumbs');
const { page } = require('./page');

function settings() {
  const c = vscode.workspace.getConfiguration('assetFinder');
  return {
    kinds: kindMap(c.get('imageExtensions') || [], c.get('videoExtensions') || []),
    skip: new Set(c.get('excludeFolders') || []),
    max: c.get('maxFiles') || 5000,
    ffmpeg: c.get('ffmpegPath') || 'ffmpeg',  };
}

function folders() {
  return (vscode.workspace.workspaceFolders || []).filter((f) => f.uri.scheme === 'file');
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const thumbDir = path.join(context.globalStorageUri.fsPath, 'thumbs');
  const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
  const versions = new Map(); // path -> stamp, so an edited file is not served from the webview cache
  let known = new Map(); // path -> asset currently shown
  let view;
  let thumbnail;
  let scanId = 0;
  let timer;
  const log = vscode.window.createOutputChannel('Asset Finder');

  const resetThumbnailer = () => {
    thumbnail = createThumbnailer(thumbDir, ffmpegCandidates(settings().ffmpeg));
  };
  resetThumbnailer();

  const roots = () => [mediaUri, ...folders().map((f) => f.uri)];

  async function refresh() {
    if (!view) return;
    const id = ++scanId;
    const s = settings();
    const found = [];
    for (const folder of folders()) {
      await walk(folder.uri.fsPath, s, found);
    }
    if (id !== scanId || !view) return;
    const multi = folders().length > 1;
    const assets = found.map((a) => {
      const uri = vscode.Uri.file(a.path);
      const v = versions.get(a.path) || 0;
      return {
        ...a,
        v,
        rel: vscode.workspace.asRelativePath(uri, multi),
        uri: view.webview.asWebviewUri(uri).toString() + (v ? '?v=' + v : ''),
      };
    });
    assets.sort((a, b) => a.rel.localeCompare(b.rel));
    known = new Map(assets.map((a) => [a.path, a]));
    let note = '';
    if (folders().length === 0) note = 'Open a folder to see its images and videos.';
    else if (found.length >= s.max) note = 'Showing the first ' + s.max + ' assets (assetFinder.maxFiles).';
    view.webview.postMessage({ type: 'assets', assets, note });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 500);
  }

  async function open(asset) {
    const uri = vscode.Uri.file(asset.path);
    const editor = asset.kind === 'video' ? 'vscode.videoPreview' : 'imagePreview.previewEditor';
    try {
      await vscode.commands.executeCommand('vscode.openWith', uri, editor);
    } catch {
      await vscode.commands.executeCommand('vscode.open', uri);
    }
  }

  // Right-click commands get the tile's data-vscode-context.
  const onAsset = (run) => (ctx) => {
    const asset = ctx && known.get(ctx.assetPath);
    if (asset) return run(asset, vscode.Uri.file(asset.path));
  };

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  const touched = (changed) => (uri) => {
    if (!settings().kinds.has(extOf(uri.fsPath))) return;
    if (changed) versions.set(uri.fsPath, Date.now());
    schedule();
  };

  context.subscriptions.push(
    watcher,
    log,
    watcher.onDidCreate(touched(true)),
    watcher.onDidChange(touched(true)),
    watcher.onDidDelete(touched(false)),
    { dispose: () => clearTimeout(timer) },
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (view) view.webview.options = { enableScripts: true, localResourceRoots: roots() };
      refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('assetFinder')) return;
      resetThumbnailer();
      refresh();
    }),
    vscode.window.registerWebviewViewProvider(
      'assetFinder.assets',
      {
        resolveWebviewView(webviewView) {
          view = webviewView;
          const webview = view.webview;
          webview.options = { enableScripts: true, localResourceRoots: roots() };
          const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
          webview.html = page(
            nonce,
            webview.cspSource,
            webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'view.js')),
            webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'view.css'))
          );
          webview.onDidReceiveMessage((m) => {
            if (m.type === 'ready') {
              refresh();
              return;
            }
            const asset = known.get(m.path);
            if (!asset) return;
            if (m.type === 'open') open(asset);
            if (m.type === 'thumbBroken') log.appendLine('thumbnail did not render: ' + asset.path);
            if (m.type === 'thumb') {
              // Sent inline as a data URI: small, and it does not depend on the webview being allowed to read the cache folder.
              thumbnail(asset.path)
                .then((file) => fs.promises.readFile(file))
                .then(
                  (jpg) => webview.postMessage({ type: 'thumb', key: m.key, uri: 'data:image/jpeg;base64,' + jpg.toString('base64') }),
                  (err) => {
                    log.appendLine('thumbnail failed: ' + asset.path + ': ' + err.message);
                    webview.postMessage({ type: 'thumb', key: m.key, error: err.message });
                  }
                );
            }
          });
          view.onDidDispose(() => {
            if (view === webviewView) view = undefined;
          });
        },
      },
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('assetFinder.refresh', refresh),
    vscode.commands.registerCommand('assetFinder.smaller', () => view && view.webview.postMessage({ type: 'zoom', step: -1 })),
    vscode.commands.registerCommand('assetFinder.bigger', () => view && view.webview.postMessage({ type: 'zoom', step: 1 })),
    vscode.commands.registerCommand('assetFinder.open', onAsset((asset) => open(asset))),
    vscode.commands.registerCommand('assetFinder.openExternal', onAsset((_asset, uri) => vscode.env.openExternal(uri))),
    vscode.commands.registerCommand('assetFinder.revealInFinder', onAsset((_asset, uri) => vscode.commands.executeCommand('revealFileInOS', uri))),
    vscode.commands.registerCommand('assetFinder.revealInExplorer', onAsset((_asset, uri) => vscode.commands.executeCommand('revealInExplorer', uri))),
    vscode.commands.registerCommand('assetFinder.copyPath', onAsset((asset) => vscode.env.clipboard.writeText(asset.path))),
    vscode.commands.registerCommand('assetFinder.copyRelativePath', onAsset((asset) => vscode.env.clipboard.writeText(asset.rel)))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
