const assert = require('assert');
const { qualified, uploadDataSql, copyTablesSql } = require('./sql');

assert.strictEqual(qualified('db', 'main', 'my "t"'), '"db"."main"."my ""t"""');

assert.strictEqual(
	uploadDataSql({ database: 'db', newDatabase: false, schema: 'main', table: 't', relation: "read_csv('a.csv')" }),
	`CREATE TABLE "db"."main"."t" AS SELECT * FROM read_csv('a.csv');`,
);

assert.strictEqual(
	uploadDataSql({ database: 'db', newDatabase: false, schema: 'raw', table: 't', relation: 'r()' }),
	`CREATE SCHEMA IF NOT EXISTS "db"."raw"; CREATE TABLE "db"."raw"."t" AS SELECT * FROM r();`,
);

assert.strictEqual(
	uploadDataSql({ database: 'db', newDatabase: true, schema: 'raw', table: 't', relation: 'r()' }),
	`CREATE DATABASE "db"; CREATE SCHEMA IF NOT EXISTS "db"."raw"; CREATE TABLE "db"."raw"."t" AS SELECT * FROM r();`,
);

assert.strictEqual(
	uploadDataSql({ database: 'db', newDatabase: true, schema: 'main', table: 't', relation: 'r()' }),
	`CREATE DATABASE "db"; CREATE TABLE "db"."main"."t" AS SELECT * FROM r();`,
);

assert.strictEqual(
	copyTablesSql({
		database: 'db',
		newDatabase: false,
		schema: 'raw',
		source: 'src',
		tables: [
			{ schema_name: 'main', table_name: 'a' },
			{ schema_name: 'other', table_name: 'b' },
		],
	}),
	`BEGIN; CREATE SCHEMA IF NOT EXISTS "db"."raw"; ` +
		`CREATE TABLE "db"."raw"."a" AS SELECT * FROM "src"."main"."a"; ` +
		`CREATE TABLE "db"."raw"."other_b" AS SELECT * FROM "src"."other"."b"; COMMIT;`,
);

console.log('ok');
