const { execFile } = require('child_process');

/** @param {string} databaseSql SQL expression for the database name, e.g. current_database() */
function schemaSql(databaseSql) {
	return `
SELECT c.schema_name, c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_index,
       CASE WHEN t.table_name IS NULL THEN 'view' ELSE 'table' END AS kind,
       t.estimated_size AS row_count
FROM duckdb_columns() c
LEFT JOIN duckdb_tables() t
  ON t.database_name = c.database_name AND t.schema_name = c.schema_name AND t.table_name = c.table_name
WHERE NOT c.internal AND c.database_name = ${databaseSql}
ORDER BY c.schema_name, c.table_name, c.column_index`;
}

/**
 * Run one query with the CLI and parse its JSON output. The file is opened read-only, so it is
 * released as soon as the process exits. Fails if another process holds a write lock on it.
 * @param {string} exe
 * @param {string[]} args
 * @param {{env?: Record<string, string>, timeout?: number}} [options]
 * @returns {Promise<any[]>}
 */
function runJson(exe, args, options = {}) {
	const { env, timeout = 30000 } = options;
	return new Promise((resolve, reject) => {
		execFile(exe, ['-json', ...args], { maxBuffer: 64 * 1024 * 1024, timeout, env: env ? { ...process.env, ...env } : process.env }, (err, stdout, stderr) => {
			if (err) {
				reject(new Error((stderr || err.message).trim()));
				return;
			}
			resolve(stdout.trim() ? JSON.parse(stdout) : []);
		});
	});
}

/**
 * Read tables, views and columns from a database file without keeping it attached.
 * @param {string} exe
 * @param {string} file
 * @returns {Promise<{name: string, kind: string, rows: number | null, columns: {name: string, type: string, nullable: boolean}[]}[]>}
 */
async function readDatabaseSchema(exe, file) {
	return groupRelations(await runJson(exe, ['-readonly', file, '-c', schemaSql('current_database()')]));
}

/** @param {any[]} rows output of schemaSql */
function groupRelations(rows) {
	const relations = new Map();
	for (const row of rows) {
		const name = `${row.schema_name}.${row.table_name}`;
		if (!relations.has(name)) {
			relations.set(name, { name, kind: row.kind, rows: row.row_count, columns: [] });
		}
		relations.get(name).columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable });
	}
	return [...relations.values()];
}

/**
 * Read the columns DuckDB infers for a data file.
 * @param {string} exe
 * @param {string} relationSql SQL that reads the file, e.g. read_csv('x.csv')
 */
async function readDataFileSchema(exe, relationSql) {
	const rows = await runJson(exe, ['-c', `DESCRIBE SELECT * FROM ${relationSql}`]);
	return [{
		name: 'file',
		kind: 'file',
		rows: null,
		columns: rows.map((r) => ({ name: r.column_name, type: r.column_type, nullable: r.null === 'YES' })),
	}];
}

/** @param {string} value */
function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/**
 * @param {string} title
 * @param {{name: string, kind: string, rows: number | null, columns: {name: string, type: string, nullable: boolean}[]}[]} relations
 */
function renderSchemaHtml(title, relations) {
	const body = relations.length === 0
		? '<p class="empty">No tables or views.</p>'
		: relations.map((rel) => {
			const meta = [rel.kind !== 'file' ? rel.kind : null, rel.rows != null ? `${rel.rows.toLocaleString()} rows` : null]
				.filter(Boolean).join(' · ');
			const cols = rel.columns.map((c) =>
				`<tr><td>${escapeHtml(c.name)}</td><td class="type">${escapeHtml(c.type)}</td><td>${c.nullable ? '' : 'NOT NULL'}</td></tr>`).join('');
			const heading = rel.kind === 'file' ? '' : `<h2>${escapeHtml(rel.name)} <small>${escapeHtml(meta)}</small></h2>`;
			return `<section>${heading}<table><thead><tr><th>Column</th><th>Type</th><th></th></tr></thead><tbody>${cols}</tbody></table></section>`;
		}).join('');

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 16px 16px; }
h1 { font-size: 1.3em; } h2 { font-size: 1.05em; margin: 20px 0 6px; } small { color: var(--vscode-descriptionForeground); font-weight: normal; }
table { border-collapse: collapse; min-width: 420px; }
th, td { text-align: left; padding: 3px 14px 3px 0; border-bottom: 1px solid var(--vscode-panel-border); }
th { color: var(--vscode-descriptionForeground); font-weight: normal; }
.type { font-family: var(--vscode-editor-font-family); color: var(--vscode-symbolIcon-typeParameterForeground, inherit); }
.empty { color: var(--vscode-descriptionForeground); }
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

/**
 * @param {string} title
 * @param {any[]} rows
 * @param {string} note
 */
function renderRowsHtml(title, rows, note) {
	const cols = rows.length ? Object.keys(rows[0]) : [];
	const cell = (v) => {
		if (v === null || v === undefined) {
			return '<td class="null">NULL</td>';
		}
		const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
		return `<td>${escapeHtml(text.length > 200 ? `${text.slice(0, 200)}…` : text)}</td>`;
	};
	const table = rows.length === 0
		? '<p class="empty">No rows.</p>'
		: `<table><thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${
			rows.map((r) => `<tr>${cols.map((c) => cell(r[c])).join('')}</tr>`).join('')}</tbody></table>`;
	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 16px 16px; }
h1 { font-size: 1.3em; } small { color: var(--vscode-descriptionForeground); font-weight: normal; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 3px 14px 3px 0; border-bottom: 1px solid var(--vscode-panel-border); white-space: nowrap; }
th { color: var(--vscode-descriptionForeground); font-weight: normal; }
.null { color: var(--vscode-descriptionForeground); font-style: italic; }
.empty { color: var(--vscode-descriptionForeground); }
</style></head><body><h1>${escapeHtml(title)} <small>${escapeHtml(note)}</small></h1>${table}</body></html>`;
}

module.exports = { runJson, schemaSql, groupRelations, readDatabaseSchema, readDataFileSchema, renderSchemaHtml, renderRowsHtml };
