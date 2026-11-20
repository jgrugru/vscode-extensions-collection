/** Wizard webview HTML. Everything is a dropdown; "Pick..." reveals a checklist. */
function page(nonce, found) {
	const data = JSON.stringify(found).replace(/</g, '\\u003c');
	return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'">
<style>
*{box-sizing:border-box}
:root{--accent:#d97757;--accent-fg:#fff;--serif:ui-serif,Georgia,'Times New Roman',serif}
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:14px 32px 90px 14px;margin:0;line-height:1.4}
h1{font-family:var(--serif);font-weight:500;font-size:1.5em;margin:0 0 4px;display:flex;align-items:center;gap:8px}h1 svg{color:var(--accent);flex:none}.sub{opacity:.7;margin:0 0 20px}
.step{position:relative;padding:0 0 22px 38px}
.step:before{content:"";position:absolute;left:12px;top:26px;bottom:0;width:2px;background:color-mix(in srgb,var(--accent) 35%,transparent)}
.step:last-of-type:before{display:none}
.num{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--accent-fg);text-align:center;line-height:26px;font-weight:600;font-size:.9em}
.step h2{font-family:var(--serif);font-weight:500;margin:2px 0 12px;font-size:1.15em}
.num{cursor:pointer;user-select:none;border:2px solid var(--accent);line-height:22px}.num:hover{filter:brightness(1.15)}
.step.min .num{background:transparent;color:var(--accent)}
.step.min h2{margin-bottom:0}
.step.min>*:not(h2):not(.num){display:none}
.f{margin:0 0 14px}.f>label,.f>.l{display:block;font-weight:600;margin-bottom:4px}
.help{opacity:.65;font-size:.88em;margin-top:4px}
select,input[type=text],textarea{width:100%;font:inherit;color:var(--vscode-dropdown-foreground,var(--vscode-input-foreground));background:var(--vscode-dropdown-background,var(--vscode-input-background));border:1px solid var(--vscode-panel-border);border-radius:10px;padding:9px 12px}
select{appearance:none;-webkit-appearance:none;padding-right:38px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23999' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center}
select:focus,input:focus,textarea:focus{outline:0;border-color:var(--accent)}
.list{display:none;margin:8px 0 0 4px}.list.on{display:block}.list label{display:flex;gap:8px;align-items:center;margin:5px 0;font-weight:400}
details{margin:0 0 6px}summary{cursor:pointer;font-weight:600;padding:4px 0;opacity:.85}
details .f{margin-top:12px}
pre{white-space:pre-wrap;word-break:break-all;background:var(--vscode-textCodeBlock-background);padding:10px;border-radius:6px;font-size:.85em}
button{font:inherit;border:0;border-radius:10px;padding:9px 14px;cursor:pointer}
.go{background:var(--accent);color:var(--accent-fg);font-weight:600}.go:hover{filter:brightness(1.08)}
.alt{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.bar{position:fixed;left:0;right:0;bottom:0;padding:10px 32px 10px 14px;background:var(--vscode-sideBar-background);border-top:1px solid var(--vscode-panel-border)}
.bar .sum{font-size:.85em;opacity:.75;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .go{width:100%;padding:11px}
.cost{margin-top:10px}
.tree{max-height:220px;overflow:auto;border:1px solid var(--vscode-panel-border);border-radius:10px;padding:4px;background:var(--vscode-editor-background)}
.trow{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:6px;cursor:pointer}.trow:hover{background:var(--vscode-list-hoverBackground)}
.trow .caret{width:12px;flex:none;opacity:.6;text-align:center;transition:transform .12s}.trow .caret.open{transform:rotate(90deg)}
.trow .tn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trow .add{flex:none;width:22px;height:22px;padding:0;border-radius:50%;background:transparent;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);line-height:1;opacity:.75}.trow .add:hover{opacity:1}
.trow .add[data-s=rw]{background:#2ea043;border-color:#2ea043;color:#fff;opacity:1}
.trow .add[data-s=r]{background:transparent;border-color:#2ea043;color:#2ea043;opacity:1;font-size:.75em;font-weight:700}
.tree.root{margin-bottom:8px}.tree.extra{margin-top:8px}.tree.extra:empty{display:none}
.ico{flex:none;display:inline-flex;vertical-align:middle;margin-right:6px;opacity:.85}.ico.dir{color:var(--accent)}
.tg{display:flex;align-items:center;gap:10px;margin:0 0 8px}.tg label{flex:1;cursor:pointer}.tg .c{opacity:.65;font-size:.88em}
.tg input{appearance:none;-webkit-appearance:none;width:34px;height:20px;margin:0;flex:none;cursor:pointer;border-radius:10px;position:relative;background:var(--vscode-input-background);border:1px solid var(--vscode-panel-border)}
.tg input:before{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--vscode-foreground);opacity:.6;transition:left .12s}
.tg input:checked{background:var(--accent);border-color:var(--accent)}.tg input:checked:before{left:16px;background:#fff;opacity:1}.tg input:indeterminate:before{left:9px}
.exp{width:22px;height:22px;padding:0;flex:none;background:transparent;color:inherit;opacity:.6;border-radius:6px;transition:transform .12s}.exp:hover{opacity:1}.exp.open{transform:rotate(90deg)}
.tl{margin:-2px 0 10px 44px;font-size:.88em;opacity:.85;max-height:160px;overflow:auto}
details.adv{margin:8px 0 20px}details.adv>summary{font-family:var(--serif);font-size:1.1em}
.adv h2{font-family:var(--serif);font-weight:500;font-size:1.05em;margin:20px 0 10px}
details.model{margin:0 0 20px;padding:10px 12px;border-radius:12px;background:var(--vscode-textCodeBlock-background)}
details.model .f:first-of-type{margin-top:12px}
</style></head><body>
<h1><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12.0 9.0L12.0 2.0"/><path d="M13.6 9.5L16.0 5.6"/><path d="M14.6 10.5L20.2 7.3"/><path d="M15.0 12.1L19.0 12.2"/><path d="M14.6 13.5L20.7 17.0"/><path d="M13.5 14.6L16.0 18.9"/><path d="M11.9 15.0L11.7 21.5"/><path d="M10.4 14.5L8.3 17.9"/><path d="M9.4 13.5L3.3 17.0"/><path d="M9.0 12.0L4.5 12.0"/><path d="M9.4 10.5L3.8 7.2"/><path d="M10.5 9.4L8.2 5.5"/></svg>Start a Claude session</h1>
<p class="sub">Set it up your way, then press Start.</p>

<details class="model"><summary id="modelSum">Model: Sonnet 5.5 · Medium effort</summary>
<div class="f"><label for="model">Model</label><select id="model"><option value="">CLI default</option><option value="claude-fable-5-1">Fable 5.1</option><option value="claude-opus-5-5">Opus 5.5</option><option value="claude-sonnet-5-5" selected>Sonnet 5.5</option><option value="claude-haiku-5-5">Haiku 5.5</option></select></div>
<div class="f"><label for="effort">Thinking effort</label><select id="effort"><option value="">CLI default</option><option value="low">Low (fast, cheap)</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="xhigh">Extra high</option><option value="max">Max</option></select></div>
<div class="f"><label for="advisor">Advisor (beta)</label><select id="advisor"><option value="">None</option><option value="claude-opus-5-5">Opus 5.5</option><option value="claude-sonnet-5-5">Sonnet 5.5</option><option value="claude-fable-5-1">Fable 5.1</option></select><div class="help">A stronger model reviews the full transcript and sends advice back; the main model applies it. It must be at least as capable as the main model, and it is billed at its own rates. Ask for it in your prompt, e.g. "consult the advisor before you start".</div></div>
</details>

<div class="toggles">
<div class="tg"><input type="checkbox" id="tMcp"><label for="tMcp">MCP servers and connectors</label><span class="c" id="tMcpC"></span><button class="exp" data-l="tMcpL" title="Show list">›</button></div>
<div class="tl" id="tMcpL" hidden></div>
<div class="tg"><input type="checkbox" id="tPlugins"><label for="tPlugins">Plugins</label><span class="c" id="tPluginsC"></span></div>
<div class="tg"><input type="checkbox" id="tSkills"><label for="tSkills">Skills</label><span class="c" id="tSkillsC"></span><button class="exp" data-l="tSkillsL" title="Show list">›</button></div>
<div class="tl" id="tSkillsL" hidden></div>
<div class="tg"><input type="checkbox" id="continueSession"><label for="continueSession">Continue last conversation</label></div>
<div class="tg"><input type="checkbox" id="worktreeOn"><label for="worktreeOn">Work in a safe copy (new branch)</label></div>
<input type="text" id="worktree" placeholder="name for the copy (optional)" style="display:none;margin:0 0 8px">
<div class="help" style="margin:0 0 16px">Off means not loaded. A dash means a custom pick in Advanced. Claude works in its own copy of the repo, on a new branch, so your current files stay untouched. Merge the branch when you like the result.</div>
</div>

<div class="f" id="folders"><label>Access</label>
<div class="help" style="margin:0 0 6px">Click + to add, again for read only, again to remove. The top row does the same for the whole folder.</div>
<div id="rootRow" class="tree root"></div>
<input type="hidden" id="strict" value="">
<div id="strictRow" class="tree root"></div>
<div class="help" id="strictHelp" style="margin:-2px 0 8px"></div>
<div id="tree" class="tree"></div>
<div id="extraRows" class="tree extra"></div>
<button class="alt" id="folderAdd" style="margin-top:8px">Choose a folder...</button>
<div class="help" id="folderHelp"></div></div>
<div class="f"><label for="permissionMode">When to ask you</label><select id="permissionMode">
<option value="">Ask before risky actions</option><option value="plan">Plan only, change nothing</option><option value="acceptEdits">Auto-accept file edits</option><option value="auto">Let a classifier decide</option><option value="dontAsk">Never ask, deny anything not allowed</option><option value="bypassPermissions">Never ask, allow everything</option></select></div>

<details class="adv"><summary>Advanced options</summary>
<h2>What should load at startup?</h2>
<div class="help" style="margin:-6px 0 12px">Everything loaded adds tokens to every session.</div>
<div class="f"><label for="mcp-mode">MCP servers</label><select id="mcp-mode"><option value="all">Load all servers and connectors</option><option value="none">Load none</option><option value="pick">Pick from this folder's .mcp.json...</option></select><div class="list" id="mcp-list"></div><div class="help">User-level servers and connectors are all or nothing.</div><div id="mcp-found" class="help">Looking up servers...</div><div class="help" id="mcp-est"></div><button class="alt" id="mcp-measure" style="margin-top:6px">Measure MCP cost</button></div>
<div class="f"><label for="plugins-mode">Plugins</label><select id="plugins-mode"><option value="all">Load all plugins</option><option value="none">Load none</option><option value="pick">Pick plugins...</option></select><div class="list" id="plugins-list"></div><div class="help" id="plugins-est"></div></div>
<div class="f"><label for="skills-mode">Skills</label><select id="skills-mode"><option value="all">Load all skills</option><option value="none">Load none</option><option value="pick">Pick skills...</option></select><div class="list" id="skills-list"></div><div class="help" id="skills-est"></div></div>
<div class="f"><label for="slash">Slash commands</label><select id="slash"><option value="">Enabled</option><option value="1">Disable all slash commands (--disable-slash-commands)</option></select><div class="help">Separate from skills. Test that /clear, /compact and /voice still work if you turn this on.</div></div>

<h2>Extras</h2>
<div class="f"><label for="chatType">Chat type</label><select id="chatType">
<option value="">General: no extra skills</option>
<option value="brainstorm">Brainstorm: ask questions, design before building</option>
<option value="teach">Teach me: Socratic tutor</option>
<option value="code">Code: test-first development</option>
<option value="debug">Quick bug fix: root cause first</option></select>
<div class="help" id="chatHint">Loads one bundled skill for this session only.</div></div>
<div class="f"><label for="sources">CLAUDE.md, rules and hooks</label><select id="sources"><option value="all">Load user, project and local</option><option value="user,project">Load user and project</option><option value="user">Load user only</option><option value="project">Load project only</option><option value="none">Load none</option></select></div>
<div class="f"><label for="restricted">Stay inside this folder</label><select id="restricted"><option value="">No</option><option value="1">Yes (no shell, no web fetch, ignores settings files)</option></select></div>
<div class="f"><label for="tools-mode">Customize built-in tools</label><select id="tools-mode"><option value="all">Load all tools</option><option value="none">Load no tools (chat only)</option><option value="pick">Pick tools...</option></select><div class="list" id="tools-list"></div></div>
<div class="f"><label for="name">Session name</label><input type="text" id="name"></div>
<div class="f"><label for="bare">Minimal mode</label><select id="bare"><option value="">Off</option><option value="1">Bare: skip hooks, LSP, plugins, memory, CLAUDE.md</option></select></div>
<div class="f"><label for="safeMode">Troubleshooting</label><select id="safeMode"><option value="">Off</option><option value="1">Safe mode: disable all customizations</option></select></div>
<div class="f"><label for="systemPrompt">System prompt (replaces the default)</label><textarea id="systemPrompt" rows="3"></textarea></div>
<div class="f"><label for="appendSystemPrompt">Extra instructions</label><textarea id="appendSystemPrompt" rows="3"></textarea></div>
<div class="f"><label for="maxBudgetUsd">Spend cap (USD)</label><input type="text" id="maxBudgetUsd" placeholder="5.00"><div class="help">Stops the session after this much API spend. May apply only to non-interactive (-p) runs.</div></div>
<div class="f"><label for="addDirs">Extra folders (comma separated)</label><input type="text" id="addDirs"></div>
<div class="f"><label for="allowedTools">Always allow (comma separated)</label><input type="text" id="allowedTools" placeholder="Bash(git *),Edit"></div>
<div class="f"><label for="disallowedTools">Always deny (comma separated)</label><input type="text" id="disallowedTools"></div>

<h2>Check and start</h2>
<details><summary>Show command</summary><pre id="cmd"></pre><button class="alt" id="copy">Copy command</button></details>
<div class="cost"><div class="l" style="font-weight:600">Startup token cost</div>
<div class="help">Runs one tiny request with these settings and reports real input tokens.</div>
<div style="margin-top:8px"><button class="alt" id="measure">Measure this setup</button> <button class="alt" id="baseline">Measure defaults</button></div>
<pre id="result">No measurement yet.</pre></div>
</details>

<div class="bar"><div class="sum" id="sum"></div><button class="go" id="launch">Start Claude</button></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const found = ${data};
const $ = (id) => document.getElementById(id);
const toolNames = ['Bash','Read','Edit','Write','Glob','Grep','WebFetch','WebSearch','Task','NotebookEdit','TodoWrite'];
const names = (a) => a.map((x) => x.name);
const tok = {}; for (const x of [...found.skills, ...found.plugins]) tok[x.name] = x.tokens;
const lists = { tools: toolNames, mcp: Object.keys(found.mcpServers), plugins: names(found.plugins), skills: names(found.skills) };
const fmt = (n) => '~' + n.toLocaleString() + ' tokens';
const sum = (a) => a.reduce((t, x) => t + x.tokens, 0);
$('skills-mode').options[0].textContent = 'Load all skills (' + fmt(sum(found.skills)) + ')';
$('plugins-mode').options[0].textContent = 'Load all plugins (' + fmt(sum(found.plugins)) + ')';
function estimate() {
  for (const [g, items] of [['skills', found.skills], ['plugins', found.plugins]]) {
    const m = $(g + '-mode').value;
    const t = m === 'all' ? sum(items) : m === 'none' ? 0 : picked(g, true).reduce((a, n) => a + (tok[n] || 0), 0);
    $(g + '-est').textContent = 'Startup cost of this choice: ' + fmt(t) + ' (estimated from names and descriptions)';
  }
}
let step = 0;

for (const [g, items] of Object.entries(lists)) {
  const el = $(g + '-list');
  el.innerHTML = items.length ? items.map((i) => '<label><input type="checkbox" data-g="' + g + '" value="' + i + '" checked> ' + i + (tok[i] ? ' <span class="help">' + fmt(tok[i]) + '</span>' : '') + '</label>').join('') : '<span class="hint">none found</span>';
  $(g + '-mode').onchange = () => el.classList.toggle('on', $(g + '-mode').value === 'pick');
  if (items.length) {
    const bar = document.createElement('div');
    bar.innerHTML = '<button type="button" class="alt" data-all="1">Select all</button> <button type="button" class="alt" data-all="">Select none</button>';
    bar.onclick = (e) => { if (e.target.dataset.all === undefined) return; for (const c of el.querySelectorAll('input')) c.checked = !!e.target.dataset.all; send(); };
    el.prepend(bar);
  }
}
const picked = (g, want) => [...document.querySelectorAll('input[data-g=' + g + ']')].filter((c) => c.checked === want).map((c) => c.value);

const chatHints = {
  '': 'Loads one bundled skill for this session only.',
  brainstorm: 'Skill: brainstorming (obra/superpowers). Asks questions, proposes approaches, and writes a design doc before any building.',
  teach: 'Skill: socratic-method (malkreide). Guides you with questions instead of giving answers. Say "just tell me" to get direct help.',
  code: 'Skill: test-driven-development (obra/superpowers). Failing test first, then minimal code. Strict.',
  debug: 'Skill: systematic-debugging (own wording). Find the root cause before any fix.',
};
$('chatType').onchange = () => { $('chatHint').textContent = chatHints[$('chatType').value]; };
$('worktreeOn').onchange = () => { $('worktree').style.display = $('worktreeOn').checked ? 'block' : 'none'; };
const toggles = [['tMcp', 'mcp-mode'], ['tPlugins', 'plugins-mode'], ['tSkills', 'skills-mode']];
for (const [t, sel] of toggles) $(t).oninput = () => { $(sel).value = $(t).checked ? 'all' : 'none'; if ($(sel).onchange) $(sel).onchange(); };
function syncToggles() {
  for (const [t, sel] of toggles) { const v = $(sel).value; $(t).checked = v === 'all'; $(t).indeterminate = v !== 'all' && v !== 'none'; }
}
$('tSkillsC').textContent = fmt(sum(found.skills));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
$('tSkillsL').innerHTML = found.skills.length ? found.skills.map((s) => esc(s.name) + ' <span style="opacity:.6">' + fmt(s.tokens) + '</span>').join('<br>') : 'No skills found.';
for (const b of document.querySelectorAll('.exp')) b.onclick = () => { const l = $(b.dataset.l); l.hidden = !l.hidden; b.classList.toggle('open', !l.hidden); };
$('tPluginsC').textContent = fmt(sum(found.plugins));

const icoDir = '<svg class="ico dir" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.2l1.4 1.5h6.4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>';
const icoFile = '<svg class="ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3.5 1.5h6l3 3v10h-9z"/><path d="M9.5 1.5v3h3"/></svg>';
const chosen = new Map();
const btns = {};
const marks = { '': '+', rw: '\u2713', r: 'R' };
const tips = { '': 'Add to session', rw: 'In session: read and edit. Click for read only.', r: 'In session: read only. Click to remove.' };
const rootKey = found.root || '';
function folderHelp() {
  const whole = chosen.has(rootKey);
  for (const id of ['tree', 'extraRows', 'folderAdd']) $(id).style.display = whole ? 'none' : '';
  $('folderHelp').textContent = whole ? 'Whole workspace: ' + (chosen.get(rootKey).level === 'r' ? 'read only.' : 'read and edit.') + ' Toggle it off to pick folders.' : chosen.size ? 'Green = read and edit, R = read only. Claude starts in the first one; the others are added to the session.' : 'None chosen: Claude gets the whole workspace.';
}
function paint(p) {
  const lv = (chosen.get(p) || {}).level || '';
  for (const b of btns[p] || []) { b.dataset.s = lv; b.textContent = marks[lv]; b.title = tips[lv]; }
}
const extras = new Map();
function dropExtra(p) {
  const wrap = extras.get(p); if (!wrap) return;
  btns[p] = (btns[p] || []).filter((b) => !wrap.contains(b));
  wrap.remove(); extras.delete(p);
}
function cycle(p, name, isFile) {
  const cur = (chosen.get(p) || {}).level || '';
  if (cur === '') chosen.set(p, { file: !!isFile, level: 'rw' });
  else if (cur === 'rw') chosen.set(p, { file: !!isFile, level: 'r' });
  else { chosen.delete(p); dropExtra(p); }
  paint(p); folderHelp(); send();
}
function treeRow(it, depth) {
  const wrap = document.createElement('div');
  const row = document.createElement('div'); row.className = 'trow'; row.style.paddingLeft = depth * 14 + 'px';
  const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = it.dir ? '\u203a' : '';
  const nm = document.createElement('span'); nm.className = 'tn'; nm.innerHTML = it.dir ? icoDir : icoFile; nm.append(it.name); nm.title = it.path;
  const add = document.createElement('button'); add.className = 'add';
  (btns[it.path] = btns[it.path] || []).push(add); paint(it.path);
  add.onclick = (e) => { e.stopPropagation(); cycle(it.path, it.name, !it.dir); };
  row.append(caret, nm, add); wrap.appendChild(row);
  if (it.dir) {
    const kids = document.createElement('div'); kids.hidden = true; wrap.appendChild(kids);
    let loaded = false;
    row.onclick = () => {
      kids.hidden = !kids.hidden; caret.classList.toggle('open', !kids.hidden);
      if (!loaded) { loaded = true; pending[it.path] = (list) => list.forEach((c) => kids.appendChild(treeRow(c, depth + 1))); vscode.postMessage({ type: 'listDir', path: it.path }); }
    };
  }
  return wrap;
}
function addPicked(p) {
  if (!chosen.has(p)) { chosen.set(p, { file: false, level: 'rw' }); }
  if (!btns[p]) { const wrap = treeRow({ path: p, name: p.split('/').pop() || p, dir: true }, 0); extras.set(p, wrap); $('extraRows').appendChild(wrap); }
  paint(p); folderHelp();
}
folderHelp();
const pending = {};
{
  const row = document.createElement('div'); row.className = 'trow'; row.title = found.root || '';
  const nm = document.createElement('span'); nm.className = 'tn'; nm.innerHTML = icoDir; nm.append('Whole workspace');
  const add = document.createElement('button'); add.className = 'add'; (btns[found.root || ''] = []).push(add); paint(found.root || '');
  const set = (level) => { if (level) chosen.set(found.root || '', { file: false, level }); else chosen.delete(found.root || ''); paint(found.root || ''); folderHelp(); send(); };
  const level = () => (chosen.get(found.root || '') || {}).level;
  row.onclick = () => set(level() === 'rw' ? 'r' : level() === 'r' ? '' : 'rw');
  row.append(nm, add); $('rootRow').appendChild(row);
}
const strictText = {
  '': ['Strict lock: off', 'Claude can ask to go outside the folders you picked.'],
  ro: ['Strict lock: read only', 'Only Read, Glob and Grep, and only inside the picked folders. No shell, no edits, no web.'],
  rw: ['Strict lock: read and edit', 'Edits and shell commands allowed, but the shell runs in a sandbox: it can write only in the picked read-and-edit folders and cannot read your home folder except the picked ones. Anything else is refused, not asked.'],
};
function updateStrict() {
  const v = $('strict').value, b = $('strictBtn');
  $('strictName').textContent = strictText[v][0]; $('strictHelp').textContent = strictText[v][1] + (v ? ' With no folder picked, it locks to the whole workspace.' : '');
  b.dataset.s = v === 'ro' ? 'r' : v === 'rw' ? 'rw' : ''; b.textContent = v === 'ro' ? 'R' : v === 'rw' ? '\u2713' : '+';
}
{
  const row = document.createElement('div'); row.className = 'trow';
  const nm = document.createElement('span'); nm.className = 'tn'; nm.id = 'strictName';
  const b = document.createElement('button'); b.className = 'add'; b.id = 'strictBtn';
  row.onclick = () => { $('strict').value = $('strict').value === '' ? 'ro' : $('strict').value === 'ro' ? 'rw' : ''; updateStrict(); send(); };
  row.append(nm, b); $('strictRow').appendChild(row); updateStrict();
}
$('tree').textContent = 'Loading...';
pending[found.root || ''] = (list) => { $('tree').textContent = ''; list.forEach((c) => $('tree').appendChild(treeRow(c, 0))); };
vscode.postMessage({ type: 'listDir', path: found.root || '' });
$('folderAdd').onclick = () => vscode.postMessage({ type: 'pickFolder' });
const allAccess = () => [...chosen].map(([path, v]) => ({ path, file: v.file, level: v.level }));
const folderAccess = () => allAccess().filter((f) => !chosen.has(rootKey) || f.path === rootKey);

const csv = (id) => $(id).value.split(',').map((x) => x.trim()).filter(Boolean);

function state() {
  const m = (g) => $(g + '-mode').value;
  const src = $('sources').value;
  const s = {
    model: $('model').value, effort: $('effort').value, permissionMode: $('permissionMode').value,
    restricted: !!$('restricted').value, strict: $('strict').value, folderAccess: folderAccess().length || !$('strict').value ? folderAccess() : [{ path: rootKey, file: false, level: 'rw' }], allowedTools: csv('allowedTools'), disallowedTools: csv('disallowedTools'),
    toolsMode: m('tools') === 'all' ? 'default' : m('tools') === 'none' ? 'none' : 'custom', tools: picked('tools', true),
    mcpMode: m('mcp') === 'pick' ? 'selected' : m('mcp'), mcpSelected: picked('mcp', true), mcpServers: found.mcpServers,
    disableSlashCommands: !!$('slash').value, disabledSkills: m('skills') === 'none' ? names(found.skills) : m('skills') === 'pick' ? picked('skills', false) : [],
    disabledPlugins: m('plugins') === 'none' ? names(found.plugins) : m('plugins') === 'pick' ? picked('plugins', false) : [],
    bare: !!$('bare').value, safeMode: !!$('safeMode').value, appendSystemPrompt: $('appendSystemPrompt').value, systemPrompt: $('systemPrompt').value, maxBudgetUsd: $('maxBudgetUsd').value.trim(), advisor: $('advisor').value, addDirs: csv('addDirs'),
    chatType: $('chatType').value, name: $('name').value, worktree: $('worktreeOn').checked ? ($('worktree').value || true) : '', continueSession: $('continueSession').checked,
  };
  if (src !== 'all') s.settingSources = src === 'none' ? [] : src.split(',');
  return s;
}
function summary() {
  $('modelSum').textContent = 'Model: ' + ($('model').value ? $('model').selectedOptions[0].textContent : 'CLI default') + ' · ' + ($('effort').value ? $('effort').selectedOptions[0].textContent.split(' (')[0] + ' effort' : 'default effort') + ($('advisor').value ? ' · Advisor: ' + $('advisor').selectedOptions[0].textContent : '');
  const sel = (id) => $(id).selectedOptions[0].textContent.split(':')[0];
  const parts = [$('strict').value ? 'Strict ' + ($('strict').value === 'ro' ? 'read only' : 'read+edit') : null, $('model').value ? sel('model') : 'Default model', chosen.size ? 'Custom access' : 'Whole workspace'];
  if ($('mcp-mode').value === 'none') parts.push('no MCP');
  if ($('plugins-mode').value === 'none') parts.push('no plugins');
  if ($('skills-mode').value === 'none') parts.push('no skills');
  if ($('slash').value) parts.push('no slash commands');
  $('sum').textContent = parts.filter(Boolean).join(' · ');
}
function fields() { return [...document.querySelectorAll('select[id], input[id], textarea[id]')]; }
function listBoxes() { return [...document.querySelectorAll('input[data-g]')]; }
function saveForm() {
  const v = {}; for (const f of fields()) v[f.id] = f.type === 'checkbox' ? f.checked : f.value;
  const l = {}; for (const c of listBoxes()) l[c.dataset.g + ':' + c.value] = c.checked;
  vscode.setState({ v, l, folders: allAccess() });
}
function applyForm(s) {
  for (const f of fields()) {
    if (!(f.id in s.v)) continue;
    if (f.type === 'checkbox') f.checked = s.v[f.id];
    else if (f.tagName !== 'SELECT' || [...f.options].some((o) => o.value === s.v[f.id])) f.value = s.v[f.id];
  }
  for (const c of listBoxes()) { const k = c.dataset.g + ':' + c.value; if (k in s.l) c.checked = s.l[k]; }
}
function restoreForm() {
  const s = vscode.getState();
  if (!s || !s.v) return;
  applyForm(s); updateStrict();
  for (const id of ['tools-mode', 'mcp-mode', 'plugins-mode', 'skills-mode', 'chatType', 'worktreeOn']) $(id).onchange();
  for (const f of s.folders || []) { addPicked(f.path); chosen.set(f.path, { file: f.file, level: f.level }); paint(f.path); }
  folderHelp();
}
function send() { saveForm(); syncToggles(); summary(); estimate(); vscode.postMessage({ type: 'update', state: state() }); }
document.addEventListener('change', send); document.addEventListener('input', send);
$('launch').onclick = () => vscode.postMessage({ type: 'launch', state: state() });
$('copy').onclick = () => vscode.postMessage({ type: 'copy', state: state() });
$('measure').onclick = () => { $('result').textContent = 'Measuring...'; vscode.postMessage({ type: 'measure', label: 'This config', state: state() }); };
$('baseline').onclick = () => { $('result').textContent = 'Measuring...'; vscode.postMessage({ type: 'measure', label: 'Defaults', state: {} }); };
$('mcp-measure').onclick = () => { $('mcp-est').textContent = 'Measuring (2 small requests)...'; vscode.postMessage({ type: 'mcpCost' }); };
const results = [];
window.addEventListener('message', (e) => {
  const m = e.data;
  if (m.type === 'dir' && pending[m.path]) pending[m.path](m.entries);
  if (m.type === 'picked') { for (const p of m.paths) addPicked(p); send(); }
  if (m.type === 'command')$('cmd').textContent = m.text;
  if (m.type === 'mcpList') $('tMcpL').innerHTML = m.servers.length ? m.servers.map((s) => esc(s.name) + ' <span style="opacity:.6">(' + esc(s.status) + ')</span>').join('<br>') : 'No MCP servers found.';
  if (m.type === 'mcpList') $('tMcpC').textContent = m.servers.length ? 'measuring...' : 'none found';
  if (m.type === 'mcpCost') $('tMcpC').textContent = m.error ? 'cost unavailable' : '~' + m.tokens.toLocaleString() + ' tokens';
  if (m.type === 'mcpList') $('mcp-found').innerHTML = m.servers.length ? '<b>Servers that would load:</b><br>' + m.servers.map((s) => s.name + ' <span style="opacity:.7">(' + s.status + ')</span>').join('<br>') : 'No MCP servers found.';
  if (m.type === 'mcpCost') $('mcp-est').textContent = m.error ? 'Error: ' + m.error : 'Loading all MCP servers costs about ' + m.tokens.toLocaleString() + ' tokens at startup (measured).';
  if (m.type === 'measure') {
    if (m.error) { $('result').textContent = 'Error: ' + m.error; return; }
    results.push(m);
    $('result').textContent = results.map((r) => r.label + ': ' + r.total + ' tokens (new ' + (r.input + r.created) + ', cached ' + r.read + ')' + (r.costUsd != null ? ', $' + r.costUsd.toFixed(4) : '')).join('\\n');
  }
});
restoreForm();
send();
</script></body></html>`;
}

module.exports = { page };
