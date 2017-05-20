/* eslint-disable no-process-env,no-console */
const Schema = require('../../src/schema');
const mysql = require('mysql2/promise');
const URI = require('urijs');

const TestConfig = require('./test-config');

let schema = null;
let db = null;

class TestSchema {

	static async db() {
		if (db !== null) {
			return db;
		}
		try {
			const config = (await TestConfig.get()).db;
			const uri = new URI();
			uri.scheme(config.type);
			uri.hostname(config.host || "127.0.0.1");
			uri.port(config.port || 3306);
			uri.username(config.username);
			uri.password(config.password);
			uri.path(config.database);
			uri.query(config.options);
			db = await mysql.createConnection(uri.toString(), {multipleStatements: true});
		} catch (err) {
			console.log(err);
			db = false;
		}
		return db;
	}

	static async get(options) {
		options = options || {};
		if (!options.force && schema !== null && db !== null) {
			return schema;
		}
		try {
			await TestSchema.db();
			const config = await TestConfig.get();
			if (!db) {
				schema = false;
			} else {
				schema = await new Schema().init(config.db, {drop: true});
			}
		} catch (err) {
			console.log(err);
			schema = false;
		}
		return schema;
	}

}

module.exports = TestSchema;
