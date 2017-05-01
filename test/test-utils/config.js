/* eslint-disable no-sync */
const fs = require('fs');
const Config = require('../../src/config');
const NodeRSA = require('node-rsa');
const TestSchema = require('./schema');

let config = null;

module.exports = {

	init: async function() {
		if ( config ) return config;
		const privateKey = fs.readFileSync('test/data/rsa/privkey.pem', 'utf8');
		const publicKey = new NodeRSA(privateKey).exportKey('public');
		const schema = await TestSchema.schema();
		Config.setup({
			db: 'mysql://cargo:chieshoaC8Ingoob@localhost:13701/cargo_auth?connectTimeout=1000&multipleStatements=true',
			schema: schema,
			rsaPrivateKey: privateKey,
			rsaPublicKey: publicKey
		});
		config = new Config();
		return config;
	}

};
