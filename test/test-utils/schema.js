/* eslint-disable no-process-env,no-console */
const Schema = require('../../src/schema');
const mysql = require('mysql2/promise');

const DB = process.env.CARGO_AUTH_DB || 'mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000&multipleStatements=true';

let schema = null;
let db = null;

async function assertDb() {
	if (db !== null) {
		return db;
	}
	try {
		db = await mysql.createConnection(DB, {multipleStatements: true});
	} catch (err) {
		console.log(err);
		db = false;
	}
	return db;
}

async function assertSchema(options) {
	options = options || {};
	if (!options.force && schema !== null && db !== null) {
		return schema;
	}
	try {
		await assertDb();
		if (!db) {
			schema = false;
		} else {
			schema = await Schema.init(DB, {drop: true});
		}
	} catch (err) {
		console.log(err);
		schema = false;
	}
	return schema;
}

module.exports = {
	uri: DB,
	schema: assertSchema,
	db: assertDb
};
