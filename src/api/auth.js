const crypto = require('crypto');
const VError = require('verror');

const check = require('../utils/check');
const BaseAPI = require('./base');
const API = require('../utils/api');

const ERR_UNKNOWN_USER = API.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = API.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = API.createError('ERR_LOGIN_FAILED');

class AuthAPI extends BaseAPI {

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
		const schema = this.schema.get();
		const rsaPrivateKey = this.rsa.exportKey('private');

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
		let session = await schema.model('Session').createForUser(user, rsaPrivateKey, options);
		this.emit(this.name + '.login', session);
		return session;
	}

}

module.exports = AuthAPI;
