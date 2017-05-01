const check = require('../utils/check');
const bluebird = require('bluebird');
const crypto = require('crypto');
const jwt = bluebird.promisifyAll(require('jsonwebtoken'));
const moment = require('moment');

const Config = require('../config');
const Model = require('../model');
const Schema = require('../schema');
const VError = require('verror');

const ERR_UNKNOWN_USER = Model.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = Model.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = Model.createError('ERR_LOGIN_FAILED');

let instance = null;

class UserAPI extends Model {

	constructor(config) {
		super('io.cargohub.auth');
		this.config = config || new Config();
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
			if ( err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}
		const schema = this.config.schema;
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
		const privateKey = this.config.rsaPrivateKey;
		const permissions = await user.permissions();
		let latestPBM = await schema.model('PermissionBitmap').findLatest();
		if (!latestPBM) {
			latestPBM = await schema.model('PermissionBitmap').createLatest();
		}
		const pbm = latestPBM.permissionsToBitmap(permissions);
		const userId = user.get('Id');
		let session = {
			expiresIn: options.validFor,
			issuedAt: moment().format('X'),
			userid: userId,
			username: username,
			permissions: permissions
		};
		// TODO:Something is wrong with the expiresIn time conversion. Seems to be ms instead of secs.
		session.token = await jwt.signAsync({
			iat: session.issuedAt,
			usr: {
				id: userId,
				nam: username,
			},
			pbm: {
				vers: latestPBM.Version,
				bits: pbm
			}
		}, privateKey, {
			algorithm: 'RS256',
			expiresIn: session.expiresIn
		});
		return session;
	}

	static async get() {
		if (instance) return instance;
		let schema = await Schema.get();
		return new UserAPI(schema);
	}

}

module.exports = UserAPI;
