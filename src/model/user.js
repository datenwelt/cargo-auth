const bluebird = require('bluebird');
const crypto = require('crypto');
const jwt = bluebird.promisifyAll(require('jsonwebtoken'));
const moment = require('moment');
const millis = require('ms');

const Model = require('../model');
const Schema = require('../schema');
const VError = require('verror');

const ERR_UNKNOWN_USER = Model.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = Model.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = Model.createError('ERR_LOGIN_FAILED');

let user = null;

class User extends Model {

	constructor() {
		super('io.cargohub.auth');
	}

	async login(username, password, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		const schema = await Schema.get();
		const User = schema.model('User');
		let user = await User.findOne({where: {username: username}});
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

		const Settings = schema.model('Settings');
		let { value: privateKey } = await Settings.findOne({attributes: ['value'], where: {name: 'serverPrivateKey' }});
		if ( !privateKey ) {
			throw new VError('Unable to perform login for user "%s", private key for server is not configured.');
		}
		let session = {
			expiresIn: moment().add(millis(options.validFor), 'ms').format('X'),
			issuedAt: moment().format('X'),
			username: username
		};
		const token = await jwt.signAsync({
			iat: session.issuedAt,
			username: username
		}, privateKey, {
			algorithm: 'RS256',
			expiresIn: session.expiresIn
		});
		session.token = token;
		return session;
	}

	static get() {
		if ( !user ) {
			user = new User();
		}
		return user;
	}

}

module.exports = User;
