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

/** Schema names of one database. @param {string} database */
function schemasSql(database) {
	return `SELECT schema_name FROM duckdb_schemas() WHERE NOT internal AND database_name = ${sqlString(database)} ORDER BY schema_name`;
}

/** Tables and views of one schema, without their columns. @param {string} database @param {string} schema */
function tablesSql(database, schema) {
	const where = `NOT internal AND database_name = ${sqlString(database)} AND schema_name = ${sqlString(schema)}`;
	return `
SELECT table_name, 'table' AS kind, estimated_size AS row_count FROM duckdb_tables() WHERE ${where}
UNION ALL
SELECT view_name, 'view', NULL FROM duckdb_views() WHERE ${where}
ORDER BY table_name`;
}

/** Columns of one table or view. @param {string} database @param {string} schema @param {string} table */
function columnsSql(database, schema, table) {
	return `SELECT column_name, data_type, is_nullable FROM duckdb_columns() WHERE database_name = ${sqlString(database)} AND schema_name = ${sqlString(schema)} AND table_name = ${sqlString(table)} ORDER BY column_index`;
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
	sqlString, ident, qualified, schemasSql, tablesSql, columnsSql,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
};
