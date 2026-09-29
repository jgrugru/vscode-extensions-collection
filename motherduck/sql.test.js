const assert = require('assert');
const {
	sqlString, ident, qualified, schemaSql, groupSchemaRows,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
} = require('./sql');

assert.strictEqual(sqlString("it's"), "'it''s'");
assert.strictEqual(ident('my "db"'), '"my ""db"""');
assert.strictEqual(qualified('db', 'main', 't'), '"db"."main"."t"');

assert.ok(schemaSql("'my_db'").includes("c.database_name = 'my_db'"));

assert.deepStrictEqual(
	groupSchemaRows([
		{ schema_name: 'main', table_name: 'a', column_name: 'id', data_type: 'INTEGER', is_nullable: false, kind: 'table', row_count: 10 },
		{ schema_name: 'main', table_name: 'a', column_name: 'name', data_type: 'VARCHAR', is_nullable: true, kind: 'table', row_count: 10 },
		{ schema_name: 'raw', table_name: 'b', column_name: 'x', data_type: 'DOUBLE', is_nullable: true, kind: 'view', row_count: null },
	]),
	[
		{ schema: 'main', tables: [{ table: 'a', kind: 'table', rows: 10, columns: [
			{ name: 'id', type: 'INTEGER', nullable: false },
			{ name: 'name', type: 'VARCHAR', nullable: true },
		] }] },
		{ schema: 'raw', tables: [{ table: 'b', kind: 'view', rows: null, columns: [
			{ name: 'x', type: 'DOUBLE', nullable: true },
		] }] },
	],
);
assert.deepStrictEqual(groupSchemaRows([]), []);

assert.strictEqual(
	listSnapshotsSql("o'db"),
	"SELECT snapshot_id, created_ts, active_bytes FROM md_information_schema.database_snapshots WHERE database_name = 'o''db' ORDER BY created_ts DESC",
);

assert.strictEqual(
	restoreSnapshotSql('my_db', '__md_explorer_restore_ab12', '2026-09-07 15:37:06.644'),
	'CREATE DATABASE "__md_explorer_restore_ab12" FROM "my_db" (SNAPSHOT_TIME \'2026-09-07 15:37:06.644\');',
);
assert.strictEqual(
	restoreSnapshotSql('my "quoted" db', '__md_explorer_restore_ab12', '2026-09-07 15:37:06.644'),
	'CREATE DATABASE "__md_explorer_restore_ab12" FROM "my ""quoted"" db" (SNAPSHOT_TIME \'2026-09-07 15:37:06.644\');',
);

assert.strictEqual(copyDatabaseSql('my_db', 'out'), 'COPY FROM DATABASE "my_db" TO "out";');

assert.strictEqual(
	copyTableSql('my_db', 'raw', 'customers', 'out'),
	'CREATE TABLE "out"."customers" AS SELECT * FROM "my_db"."raw"."customers";',
);
assert.strictEqual(
	copyTableSql('my db', 'raw', 'my "table"', 'out'),
	'CREATE TABLE "out"."my ""table""" AS SELECT * FROM "my db"."raw"."my ""table""";',
);

assert.strictEqual(dropDatabaseSql('__md_explorer_restore_ab12'), 'DROP DATABASE "__md_explorer_restore_ab12";');

console.log('ok');
