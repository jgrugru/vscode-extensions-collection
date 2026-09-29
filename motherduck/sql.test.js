const assert = require('assert');
const {
	sqlString, ident, qualified, schemasSql, tablesSql, columnsSql,
	listSnapshotsSql, restoreSnapshotSql, copyDatabaseSql, copyTableSql, dropDatabaseSql,
} = require('./sql');

assert.strictEqual(sqlString("it's"), "'it''s'");
assert.strictEqual(ident('my "db"'), '"my ""db"""');
assert.strictEqual(qualified('db', 'main', 't'), '"db"."main"."t"');

assert.ok(schemasSql("o'db").includes("database_name = 'o''db'"));

const tables = tablesSql('my_db', 'raw');
assert.ok(tables.includes("database_name = 'my_db' AND schema_name = 'raw'"));
assert.ok(tables.includes('duckdb_tables()') && tables.includes('duckdb_views()'));

const columns = columnsSql('my_db', 'raw', "o't");
assert.ok(columns.includes("schema_name = 'raw' AND table_name = 'o''t'"));

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
