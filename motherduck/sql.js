/** Quote a value as a SQL string literal. @param {string} value */
function sqlString(value) {
	return `'${value.replace(/'/g, "''")}'`;
}

/** Quote a name as a SQL identifier. @param {string} name */
function ident(name) {
	return `"${name.replace(/"/g, '""')}"`;
}

/** Quote and join a dotted name, such as database.schema.table. @param {...string} parts */
function qualified(...parts) {
	return parts.map(ident).join('.');
}

/** @param {string} databaseSql SQL expression for the database name, e.g. a quoted literal */
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
 * Group schemaSql's flat column rows into schemas, each with its tables and their columns.
 * @param {any[]} rows
 * @returns {{schema: string, tables: {table: string, kind: string, rows: number | null, columns: {name: string, type: string, nullable: boolean}[]}[]}[]}
 */
function groupSchemaRows(rows) {
	const schemas = new Map();
	for (const row of rows) {
		if (!schemas.has(row.schema_name)) {
			schemas.set(row.schema_name, new Map());
		}
		const tables = schemas.get(row.schema_name);
		if (!tables.has(row.table_name)) {
			tables.set(row.table_name, { table: row.table_name, kind: row.kind, rows: row.row_count, columns: [] });
		}
		tables.get(row.table_name).columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable });
	}
	return [...schemas.entries()].map(([schema, tables]) => ({ schema, tables: [...tables.values()] }));
}

/** @param {string} database */
function listSnapshotsSql(database) {
	return `SELECT snapshot_id, created_ts, active_bytes FROM md_information_schema.database_snapshots WHERE database_name = ${sqlString(database)} ORDER BY created_ts DESC`;
}

/**
 * Restore a snapshot of `source` into a brand-new database `tempName`. The source is untouched.
 * @param {string} source @param {string} tempName @param {string} snapshotTime
 */
function restoreSnapshotSql(source, tempName, snapshotTime) {
	return `CREATE DATABASE ${ident(tempName)} FROM ${ident(source)} (SNAPSHOT_TIME ${sqlString(snapshotTime)});`;
}

/** Copy a whole attached database's schema and data into another attached database. @param {string} database @param {string} targetAlias */
function copyDatabaseSql(database, targetAlias) {
	return `COPY FROM DATABASE ${ident(database)} TO ${ident(targetAlias)};`;
}

/** Copy one table's data into a new table in another attached database. @param {string} database @param {string} schema @param {string} table @param {string} targetAlias */
function copyTableSql(database, schema, table, targetAlias) {
	return `CREATE TABLE ${qualified(targetAlias, table)} AS SELECT * FROM ${qualified(database, schema, table)};`;
}

/** @param {string} name */
function dropDatabaseSql(name) {
	return `DROP DATABASE ${ident(name)};`;
}

module.exports = {
	sqlString, ident, qualified, schemaSql, groupSchemaRows,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
};
