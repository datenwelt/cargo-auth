/* eslint-disable no-unused-expressions,no-invalid-this */
const mysql = require('mysql2/promise');
const assert = require('chai').assert;

const Schema = require('../../src/schema');
const it = require("mocha").it;
const before = require("mocha").before;
const describe = require("mocha").describe;

const utils = require('./utils/schema');

describe('schema.js', function() {

	// const DB = "mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000";

	let skip = null;

	before(async function() {
		skip = await utils.assertDb();
	});

	describe('Schema.init()', function() {

		it("defines the schema", async function() {
			if ( !skip ) return this.skip();
			const schema = await Schema.init(null, { drop: true });
			assert.instanceOf(schema, Schema);
			assert.isDefined(schema.uri);
			assert.isDefined(schema.sequelize);
			return true;
		});
	});

});

