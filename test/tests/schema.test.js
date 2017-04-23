const mysql = require('mysql2/promise');
const expect = require('chai').expect;

const Schema = require('../../src/schema');

describe('schema.js', function() {

	const DB = "mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000";

	let connection;

	before(async function() {
		try {
			connection = await mysql.createConnection(DB);
		} catch(err) {
		}
		return true;
	});

	describe('Schema.init()', function() {

		it("defines the schema", async function() {
			if ( !connection ) return this.skip();
			const schema = await Schema.init(DB, { drop: true });
			expect(schema.models).to.exist;

		});
	});

});

