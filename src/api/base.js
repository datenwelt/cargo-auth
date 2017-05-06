const API = require('../utils/api');
const RSA = require('../utils/rsa');
const Schema = require('../schema');
const VError = require('verror');

class BaseAPI extends API {

	constructor(name) {
		super(name);
		this.schema = null;
	}

	async init(config) {
		if (!config.db || !config.db.cargo_auth) {
			throw new VError('Missing section "db.cargo_auth" in API configuration.');
		}
		this.schema = await new Schema('cargo_auth').init(config.db.cargo_auth);
		if (!config.rsa || !config.rsa.privateKey)
			throw new VError('Missing section "db.rsa" with RSA private key in API configuration.');

		this.rsa = await RSA.init(config.rsa);
		return this;
	}

	close() {
		if (this.schema) {
			Schema.close('cargo_auth');
			this.schema = null;
		}
	}

}

module.exports = BaseAPI;
