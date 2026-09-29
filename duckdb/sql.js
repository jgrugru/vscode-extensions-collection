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

/** @param {string} database @param {string} schema */
function createSchemaSql(database, schema) {
	return schema === 'main' ? '' : `CREATE SCHEMA IF NOT EXISTS ${qualified(database, schema)};`;
}

/**
 * Load a data file relation into a new table, creating the database and schema when needed.
 * @param {{database: string, newDatabase: boolean, schema: string, table: string, relation: string}} target
 */
function uploadDataSql({ database, newDatabase, schema, table, relation }) {
	return [
		newDatabase && `CREATE DATABASE ${ident(database)};`,
		createSchemaSql(database, schema),
		`CREATE TABLE ${qualified(database, schema, table)} AS SELECT * FROM ${relation};`,
	].filter(Boolean).join(' ');
}

/** Tables of an attached database. @param {string} alias */
function listTablesSql(alias) {
	return `SELECT schema_name, table_name FROM duckdb_tables() WHERE database_name = ${sqlString(alias)} ORDER BY schema_name, table_name`;
}

/**
 * Copy every table of an attached database into one schema, in one transaction.
 * A table from a non-main source schema is named <source schema>_<table> so tables from different schemas cannot collide.
 * @param {{database: string, schema: string, source: string, tables: {schema_name: string, table_name: string}[]}} copy
 */
function copyTablesSql({ database, schema, source, tables }) {
	const copies = tables.map((t) => {
		const name = t.schema_name === 'main' ? t.table_name : `${t.schema_name}_${t.table_name}`;
		return `CREATE TABLE ${qualified(database, schema, name)} AS SELECT * FROM ${qualified(source, t.schema_name, t.table_name)};`;
	});
	return ['BEGIN;', createSchemaSql(database, schema), ...copies, 'COMMIT;'].filter(Boolean).join(' ');
}

module.exports = { sqlString, ident, qualified, uploadDataSql, listTablesSql, copyTablesSql };
