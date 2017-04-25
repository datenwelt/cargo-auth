const Schema = require('../../../src/schema');

module.exports = {

	resetSchema: async function(options) {
		const schema = await Schema.init('mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000', options);
		return schema;
	}

};
