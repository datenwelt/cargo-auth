/* eslint-disable no-unused-expressions,no-invalid-this */
const mysql = require('mysql2/promise');
const assert = require('chai').assert;

const Schema = require('../../src/schema');
const it = require("mocha").it;
const before = require("mocha").before;
const describe = require("mocha").describe;

describe('schema.js', function() {

	const DB = "mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000";

	let connection = null;

	before(async function() {
		try {
			connection = await mysql.createConnection(DB);
		} catch (err) {
			connection = null;
		}
		return true;
	});

	describe('Schema.init()', function() {

		it("defines the schema", async function() {
			if ( !connection ) return this.skip();
			const schema = await Schema.init(DB, { drop: true });
			assert.isDefined(schema.models);
			return true;
		});
	});

});

