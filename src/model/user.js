const crypto = require('crypto');

const Model = require('../model');
const VError = require('verror');

const ERR_UNKNOWN_USER = Model.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = Model.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = Model.createError('ERR_LOGIN_FAILED');

class User extends Model {

	constructor(schema) {
		super('io.cargohub.auth', schema);
	}

	async login(username, password) {
		const db = this.schema.model('User');
		let user = await db.findOne({where: {username: username}});
		if (!user) throw this.error(ERR_UNKNOWN_USER);
		if (!user.get('active')) {
			throw this.error(ERR_LOGIN_SUSPENDED);
		}
		let matches = (user.get('password') || "").match(/^\{(SHA1|MD5|SHA256)\}(.+$)/);
		if (!matches) throw new VError('Unable to perform login for user "%s", password value does not start with "{SHA1|MD5|SHA256}"', username);
		const hash = crypto.createHash(matches[1]);
		hash.update(password);
		const hashed = hash.digest('hex');
		if (hashed.toLowerCase() !== matches[2].toLowerCase()) {
			throw this.error(ERR_LOGIN_FAILED);
		}
		return {};
	}

}

module.exports = User;
