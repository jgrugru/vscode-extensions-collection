/** Sidebar webview shell; the gallery itself is media/view.js. */
function page(nonce, cspSource, scriptUri, styleUri) {
  const csp = [
    "default-src 'none'",
    'img-src ' + cspSource + ' data:',
    'media-src ' + cspSource,
    'style-src ' + cspSource,
    "script-src 'nonce-" + nonce + "'",
  ].join('; ');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">',
    '<link rel="stylesheet" href="' + styleUri + '">',
    '</head><body data-vscode-context=\'{"preventDefaultContextMenuItems":true}\'>',
    '<div id="top"><input id="search" type="text" placeholder="Filter by name or folder"><div id="chips"></div></div>',
    '<div id="status"></div><div id="grid"></div>',
    '<script nonce="' + nonce + '" src="' + scriptUri + '"></script>',
    '</body></html>',
  ].join('\n');
}

module.exports = { page };
