/* eslint-disable no-sync,no-process-env */
const fs = require('fs');
const NodeRSA = require('node-rsa');
const TestSchema = require('./schema');

let config = null;

module.exports = {

	init: async function() {
		if ( config ) return config;
		const privateKeyFile = process.env.CARGO_AUTH_PRIVKEY_FILE || 'test/data/rsa/privkey.pem';
		const privateKey = fs.readFileSync(privateKeyFile, 'utf8');
		const publicKey = new NodeRSA(privateKey).exportKey('public');
		const db = await TestSchema.db();
		const schema = await TestSchema.schema();
		return {
			db: db,
			schema: schema,
			rsaPrivateKey: privateKey,
			rsaPublicKey: publicKey
		};
	}

};
