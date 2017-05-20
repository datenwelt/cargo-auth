const crypto = require('crypto');
const VError = require('verror');
const moment = require('moment');
const ms = require('ms');

const API = require('@datenwelt/cargo-api').API;
const check = require('@datenwelt/cargo-api').Check;
const Mailer = require('@datenwelt/cargo-api').Mailer;

const BaseAPI = require('./base');

const ERR_UNKNOWN_USER = API.createError('ERR_UNKNOWN_USER');
const ERR_LOGIN_SUSPENDED = API.createError('ERR_LOGIN_SUSPENDED');
const ERR_LOGIN_FAILED = API.createError('ERR_LOGIN_FAILED');
const ERR_UNKNOWN_SESSION = API.createError('ERR_UNKNOWN_SESSION');
const ERR_SESSION_EXPIRED = API.createError('ERR_SESSION_EXPIRED');

class AuthAPI extends BaseAPI {

	constructor(name) {
		super(name);
		this.mailer = null;
	}

	async init(config, state) {
		await super.init(config, state);
		if (config.smtp) this.mailer = await new Mailer().init(config, state);
		return this;
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

	async renewSession(sessionId, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		try {
			sessionId = check(sessionId).trim('ERR_SESSION_ID_INVALID')
				.not().isBlank('ERR_SESSION_ID_MISSING')
				.val();
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}
		const schema = this.schema.get();
		const rsaPrivateKey = this.rsa.rsaPrivateKey;

		let session = await schema.model('Session').findById(sessionId);
		if (!session) throw this.error(ERR_UNKNOWN_SESSION);
		let exp = moment(session.get('ExpiresAt'));
		let now = moment();
		if (exp.isBefore(now)) throw this.error(ERR_SESSION_EXPIRED);
		let username = session.get('Username');
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw this.error(ERR_UNKNOWN_USER);
		if (!user.get('Active')) {
			throw this.error(ERR_LOGIN_SUSPENDED);
		}
		session = await schema.model('Session').createForUser(user, rsaPrivateKey, options);
		this.emit(this.name + '.login', session);
		return session;
	}

	async registerUser(username, options) {
		const schema = this.schema.get();
		options = Object.assign({expiresIn: '48h'}, options || {});
		try {
			username = check(username).trim('ERR_USERNAME_INVALID')
				.not().isBlank('ERR_USERNAME_MISSING')
				.minLength(6, 'ERR_USERNAME_TOO_SHORT')
				.maxLength(255, 'ERR_USERNAME_TOO_LONG')
				.val();
			if (typeof options.password === 'string' || options.password) {
				options.password = schema.model('User').checkPassword(options.password, [username]);
			}
			if (typeof options.email === 'string' || options.email) {
				options.email = check(options.email).trim('ERR_EMAIL_INVALID')
					.not().isBlank('ERR_EMAIL_MISSING')
					.matches(/^.+@.+$/)
					.val();
			}
			options.extra = options.extra || {};
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}

		if (options.password && !options.password.match(/^\{.+\}.*/))
			options.password = schema.model('User').createPassword(options.password);

		let user = await schema.model('User').findOne({where: {Username: username}});
		if (user) throw this.error('ERR_USERNAME_ALREADY_PRESENT');

		let activation = await schema.model('UserActivation').create({
			Id: schema.model('UserActivation').createId(),
			Username: username,
			Password: options.password,
			Email: options.email,
			Extra: JSON.stringify(options.extra),
			ExpiresAt: moment().add(ms(options.expiresIn)).toDate()
		});

		const payload = API.serialize(activation.get());
		payload.token = payload.id;
		delete payload.id;
		payload.extra = JSON.parse(activation.Extra);
		delete payload.password;
		if (options.email && this.mailer) {
			await this.mailer.sendRegistration(payload);
			delete payload.token;
		}
		this.emit(this.name + ".register", payload);
		return payload;
	}

	async activateUser(token, options) {
		options = options || {};
		options.extra = options.extra || {};
		// Check if token exists and is not expired yet.
		const schema = this.schema.get();
		try {
			token = check(token).trim('ERR_TOKEN_INVALID')
				.not().isBlank('ERR_TOKEN_MISSING')
				.val();
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}
		let activation = await schema.model('UserActivation').findById(token);
		if (!activation) throw this.error('ERR_TOKEN_UNKOWN');
		let expiresAt = moment(activation.get('ExpiresAt'));
		if (moment().isAfter(expiresAt)) throw this.error('ERR_TOKEN_EXPIRED');

		const username = activation.get('Username');
		let password = activation.get('Password');
		let email = activation.get('Email');
		try {
			if (typeof options.password === 'string' || options.password) {
				password = schema.model('User').checkPassword(options.password, [username]);
			}
			if (typeof options.email === 'string' || options.email) {
				email = check(options.email).trim('ERR_EMAIL_INVALID')
					.not().isBlank('ERR_EMAIL_MISSING')
					.matches(/^.+@.+$/)
					.val();
			}
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw this.error(err.message);
			throw err;
		}

		delete options.password;
		delete options.email;
		let extra = activation.get('Extra');
		if (extra) extra = JSON.parse(extra);
		extra = Object.assign(extra, options.extra);

		if (!password) throw this.error('ERR_PASSWORD_MISSING');
		if (!email) throw this.error('ERR_EMAIL_MISSING');
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (user) throw this.error('ERR_USERNAME_ALREADY_PRESENT');
		user = await schema.model('User').create({
			Username: username,
			Password: password,
			Email: email,
			Active: true
		});
		await activation.destroy();
		const payload = API.serialize(user.get());
		delete payload.password;
		payload.extra = extra;
		this.emit(this.name + ".activate", payload);
		return payload;
	}

	async createPasswordReset(username, options) {
		options = Object.assign({expiresIn: '48h'}, options || {});
		const schema = this.schema.get();
		try {
			username = check(username).trim('ERR_USERNAME_INVALID')
				.not().isBlank('ERR_USERNAME_MISSING')
				.val();
		} catch (err) {
			throw err.name === 'CargoCheckError' ? this.error(err.message) : err;
		}
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw this.error('ERR_USERNAME_UNKNOWN');
		if (!user.get('Active')) throw this.error('ERR_USERNAME_SUSPENDED');
		let token = schema.model('PasswordReset').createToken();
		let expiresAt = moment().add(ms(options.expiresIn));
		let passwordReset = await user.createPasswordReset({
			Token: token,
			ExpiresAt: expiresAt
		});
		let payload = API.serialize(passwordReset.get());
		payload.username = user.get('Username');
		payload.email = user.get('Email');
		delete payload.userId;
		if (this.mailer) {
			await this.mailer.sendPasswordReset(payload);
		}
		return payload;
	}

	async resetPassword(token, password) {
		const schema = this.schema.get();
		try {
			token = check(token).trim('ERR_TOKEN_INVALID')
				.not().isBlank('ERR_TOKEN_MISSING')
				.val();
		} catch (err) {
			throw err.name === 'CargoCheckError' ? this.error(err.message) : err;
		}
		let passwordReset = await schema.model('PasswordReset').findById(token);
		if (!passwordReset) throw this.error('ERR_TOKEN_UNKNOWN');
		let expiresAt = moment(passwordReset.get('ExpiresAt'));
		if (moment().isAfter(expiresAt)) throw this.error('ERR_TOKEN_EXPIRED');
		let user = await schema.model('User').findById(passwordReset.get('UserId'));
		let username = user.get('Username');
		try {
			schema.model('User').checkPassword(password, [username]);
		} catch (err) {
			throw err.name === 'CargoCheckError' ? this.error(err.message) : err;
		}
		password = schema.model('User').createPassword(password);
		user.set('Password', password);
		await user.save();
		passwordReset.destroy();
		let payload = {username: username};
		this.emit(this.name + '.password-reset', payload);
		return payload;
	}
}

module.exports = AuthAPI;
