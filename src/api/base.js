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
		if (state && state.schemas && state.schemas.cargo_auth) {
			this.schema = state.schemas.cargo_auth;
		} else {
			if (!config.db || !config.db.cargo_auth) {
				throw new VError('Missing section "db.cargo_auth" in API configuration.');
			}
			this.schema = await new Schema('cargo_auth').init(config.db.cargo_auth);
			if (state) {
				state.schemas = state.schemas || {};
				state.schemas.cargo_auth = this.schema;
			}
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
