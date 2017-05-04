const check = require('../utils/check');
const crypto = require('crypto');
const API = require('../api');
const VError = require('verror');

const ERR_UNKNOWN_USER = API.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = API.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = API.createError('ERR_LOGIN_FAILED');

class AuthAPI extends API {

	constructor(schema, rsaPrivateKey) {
		super('io.cargohub.auth');
		this.schema = schema;
		this.rsaPrivateKey = rsaPrivateKey;
	}

	async login(username, password, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		try {
			username = check(username).trim('ERR_USERNAME_INVALID')
				.not().isBlank('ERR_USERNAME_MISSING')
				.val();
			password = check(password).trim('ERR_PASSWORD_INVALID')
				.not().isBlank('ERR_PASSWORD_MISSING')
				.val();
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}
		const schema = this.schema;
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw this.error(ERR_UNKNOWN_USER);
		if (!user.get('Active')) {
			throw this.error(ERR_LOGIN_SUSPENDED);
		}
		let matches = (user.get('Password') || "").match(/^\{(SHA1|MD5|SHA256)\}(.+$)/);
		if (!matches) throw new VError('Unable to perform login for user "%s", password value does not start with "{SHA1|MD5|SHA256}"', username);
		const hash = crypto.createHash(matches[1]);
		hash.update(password);
		const hashed = hash.digest('hex');
		if (hashed.toLowerCase() !== matches[2].toLowerCase()) {
			throw this.error(ERR_LOGIN_FAILED);
		}
		const privateKey = this.rsaPrivateKey;
		let session = await schema.model('Session').createForUser(user, privateKey, options);
		this.emit(this.name + '.login', session);
		return session;
	}

}

module.exports = AuthAPI;
