const Schema = require('../../../src/schema');
const mysql = require('mysql2/promise');

const DB = 'mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000';

module.exports = {

	uri: DB,

	schema: async function (options) {
		let schema = await Schema.init(DB, options);
		return schema;
	},

	assertDb: async function () {
		let connection = null;
		try {
			connection = await mysql.createConnection(DB);
		} catch (err) {
			connection = null;
		}
		return connection;
	}

};
