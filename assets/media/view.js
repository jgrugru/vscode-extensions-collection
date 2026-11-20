(function () {
  const vscode = acquireVsCodeApi();
  const saved = vscode.getState() || {};
  let assets = [];
  let note = '';
  let filter = saved.filter || 'all';
  let query = saved.query || '';
  let grouped = saved.grouped !== false;
  const folded = saved.folded || {}; // folder -> true (closed) or false (open), once the user has clicked it
  const sizes = [56, 72, 96, 128, 176, 240, 320]; // tile widths in px
  let size = saved.size === undefined ? 2 : saved.size;
  const thumbs = new Map(); // key -> { uri } or { error }
  const requested = new Set();
  const chips = document.getElementById('chips');
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  const search = document.getElementById('search');
  search.value = query;

  function applySize() {
    document.documentElement.style.setProperty('--tile', sizes[size] + 'px');
  }
  applySize();

  function dirOf(a) {
    const cut = a.rel.lastIndexOf('/');
    return cut === -1 ? '' : a.rel.slice(0, cut);
  }

  function keyOf(a) {
    return a.path + '|' + a.v;
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Video frames are made on demand, only for tiles scrolled near the viewport.
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const key = entry.target.dataset.key;
      if (requested.has(key)) return;
      requested.add(key);
      vscode.postMessage({ type: 'thumb', path: entry.target.dataset.path, key: key });
    });
  }, { rootMargin: '300px' });

  function image(src, onError) {
    const img = el('img');
    if (src.indexOf('data:') !== 0) img.loading = 'lazy';
    img.alt = '';
    img.addEventListener('error', function () {
      img.classList.add('broken');
      if (onError) onError();
    });
    img.src = src;
    return img;
  }

  function fill(box, a) {
    box.textContent = '';
    if (a.kind === 'image') {
      box.appendChild(image(a.uri));
    } else {
      const thumb = thumbs.get(keyOf(a));
      if (thumb && thumb.uri) {
        box.appendChild(image(thumb.uri, function () {
          // Frame would not render: fall back to the video element and tell the host.
          thumbs.set(keyOf(a), { error: 'broken' });
          vscode.postMessage({ type: 'thumbBroken', path: a.path });
          fill(box, a);
        }));
      } else if (thumb && thumb.error) {
        // No ffmpeg frame: let the webview show the first frame itself.
        const video = el('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = a.uri + '#t=0.5';
        box.appendChild(video);
      }
      box.appendChild(el('span', 'play'));
    }
    box.appendChild(el('span', 'ext', a.ext));
  }

  function tile(a) {
    const node = el('button', 'tile ' + a.kind);
    node.title = a.rel;
    node.dataset.path = a.path;
    node.dataset.key = keyOf(a);
    node.dataset.vscodeContext = JSON.stringify({ webviewSection: 'asset', assetPath: a.path, preventDefaultContextMenuItems: true });
    const box = el('div', 'thumb');
    fill(box, a);
    node.appendChild(box);
    node.appendChild(el('div', 'name', a.name));
    node.addEventListener('click', function () { vscode.postMessage({ type: 'open', path: a.path }); });
    if (a.kind === 'video' && !thumbs.has(keyOf(a))) observer.observe(node);
    return node;
  }

  function chip(value, label, count) {
    const node = el('button', 'chip' + (filter === value ? ' on' : ''), label);
    node.appendChild(el('span', '', String(count)));
    node.addEventListener('click', function () { filter = value; render(); });
    return node;
  }

  function render() {
    const counts = new Map();
    assets.forEach(function (a) { counts.set(a.ext, (counts.get(a.ext) || 0) + 1); });
    if (filter !== 'all' && !counts.has(filter)) filter = 'all';
    vscode.setState({ filter: filter, query: query, grouped: grouped, folded: folded, size: size });

    chips.textContent = '';
    if (assets.length > 0) {
      const mode = el('button', 'chip mode', grouped ? 'By folder' : 'Flat');
      mode.title = 'Switch between folder groups and one flat grid';
      mode.addEventListener('click', function () { grouped = !grouped; render(); });
      chips.appendChild(mode);
      chips.appendChild(chip('all', 'All', assets.length));
      Array.from(counts.keys()).sort().forEach(function (ext) {
        chips.appendChild(chip(ext, ext.toUpperCase(), counts.get(ext)));
      });
    }

    const q = query.trim().toLowerCase();
    const shown = assets.filter(function (a) {
      return (filter === 'all' || a.ext === filter) && (!q || a.rel.toLowerCase().indexOf(q) !== -1);
    });
    observer.disconnect();
    grid.textContent = '';
    if (grouped) {
      const groups = new Map();
      shown.forEach(function (a) {
        const dir = dirOf(a);
        if (!groups.has(dir)) groups.set(dir, []);
        groups.get(dir).push(a);
      });
      // Big sets start closed so only the folder you open loads thumbnails; a search opens its matches.
      const startClosed = !q && shown.length > 24 && groups.size > 1;
      Array.from(groups.keys()).sort().forEach(function (dir) {
        const items = groups.get(dir);
        const closed = q ? false : (dir in folded ? folded[dir] : startClosed);
        const head = el('button', 'folder' + (closed ? ' closed' : ''));
        head.title = dir || 'Workspace root';
        head.appendChild(el('span', 'twist'));
        head.appendChild(el('span', 'path', dir || '.'));
        head.appendChild(el('span', 'count', String(items.length)));
        head.addEventListener('click', function () { folded[dir] = !closed; render(); });
        grid.appendChild(head);
        if (closed) return;
        const cells = el('div', 'cells');
        items.forEach(function (a) { cells.appendChild(tile(a)); });
        grid.appendChild(cells);
      });
    } else {
      const cells = el('div', 'cells');
      shown.forEach(function (a) { cells.appendChild(tile(a)); });
      grid.appendChild(cells);
    }
    if (assets.length === 0) status.textContent = note || 'No images or videos found in this workspace.';
    else if (shown.length === 0) status.textContent = 'No matches.';
    else status.textContent = note;
  }

  search.addEventListener('input', function () { query = search.value; render(); });

  window.addEventListener('message', function (event) {
    const m = event.data;
    if (m.type === 'assets') {
      assets = m.assets;
      note = m.note || '';
      render();
    }
    if (m.type === 'zoom') {
      size = Math.max(0, Math.min(sizes.length - 1, size + m.step));
      applySize();
      vscode.setState({ filter: filter, query: query, grouped: grouped, folded: folded, size: size });
    }
    if (m.type === 'thumb') {
      thumbs.set(m.key, m.uri ? { uri: m.uri } : { error: m.error || 'failed' });
      const a = assets.find(function (x) { return keyOf(x) === m.key; });
      if (!a) return;
      grid.querySelectorAll('.tile').forEach(function (node) {
        if (node.dataset.key === m.key) fill(node.firstChild, a);
      });
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
