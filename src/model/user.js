const _ = require('underscore');
const bluebird = require('bluebird');
const crypto = require('crypto');
const jwt = bluebird.promisifyAll(require('jsonwebtoken'));
const moment = require('moment');
const millis = require('ms');

const Model = require('../model');
const Schema = require('../schema');
const VError = require('verror');

const PermissionsModel = require('./permission');

const ERR_UNKNOWN_USER = Model.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = Model.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = Model.createError('ERR_LOGIN_FAILED');

let instance = null;

class User extends Model {

	constructor(schema) {
		super('io.cargohub.auth');
		this.schema = schema;
	}

	async login(username, password, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		const schema = await Schema.get();
		const User = schema.model('User');
		let user = await User.findOne({where: {Username: username}});
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

		const Settings = schema.model('Settings');
		let {Value: privateKey} = await Settings.findOne({attributes: ['Value'], where: {Name: 'serverPrivateKey'}});
		if (!privateKey) {
			throw new VError('Unable to perform login for user "%s", private key for server is not configured.', username);
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

	async permissions2Bitmap(userId) {
		const userPermissions = await (await PermissionsModel.get()).resolveUserPermissions(userId);
		const permissionBitmap = await this.schema.model('PermissionBitmap').findOne({order: [['CreatedAt', 'DESC']]});
		let version = permissionBitmap.get('Version');
		let allPermissions = permissionBitmap.get('Permissions').split(',');
		let userBitmap = 0x0;
		for (let permission of allPermissions) {
			// eslint-disable-next-line no-bitwise
			userBitmap <<= 1;
			if (_.contains(userPermissions, permission)) {
				// eslint-disable-next-line no-bitwise
				userBitmap |= 0x1;
			}
		}
		return {version: version, bits: userBitmap};
	}

	async bitmap2Permissions(version, userBitmap) {
		const permissionBitmap = await this.schema.model('PermissionBitmap').findOne({where: {Version: version}});
		let allPermissions = permissionBitmap.get('Permissions').split(',');
		if ( !allPermissions.length ) return [];
		let userPermissions = [];
		// eslint-disable-next-line no-bitwise
		let mask = 0x1 << allPermissions.length-1;
		for (let permission of allPermissions) {
			// eslint-disable-next-line no-bitwise
			let allowed = userBitmap & mask;
			if ( allowed ) userPermissions.push(permission);
			// eslint-disable-next-line no-bitwise
			mask >>= 1;
		}
		return userPermissions.sort();
	}

	static async get() {
		if (instance) return instance;
		let schema = await Schema.get();
		return new User(schema);
	}

}

module.exports = User;
