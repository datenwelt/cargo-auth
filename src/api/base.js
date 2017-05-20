const API = require('@datenwelt/cargo-api').API;
const RSA = require('@datenwelt/cargo-api').RSA;
const Schema = require('../schema');
const VError = require('verror');

class BaseAPI extends API {

	constructor(name) {
		super(name);
		this.schema = null;
	}

	async init(config, state) {
		super.init(config, state);
		if (state && state.schema) {
			this.schema = state.schema;
		} else {
			if (!config.db) {
				throw new VError('Missing section "db" in API configuration.');
			}
			this.schema = await new Schema().init(config.db);
			state = state || {};
			state.schema = this.schema;
		}
		if (state && state.rsa) {
			this.rsa = state.rsa;
		} else {
			if (!config.rsa || !config.rsa.privateKey)
				throw new VError('Missing section "db.rsa" with RSA private key in API configuration.');
			this.rsa = await RSA.init(config.rsa);
			if (state) state.rsa = this.rsa;
		}
		config.apis = config.apis || {};
		config.apis[this.name] = this;
		return this;
	}

	close() {
		if (this.schema) {
			this.schema.close();
			this.schema = null;
		}
	}

}

module.exports = BaseAPI;
