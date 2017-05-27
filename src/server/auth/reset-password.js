const express = require('express');
const HttpError = require('standard-http-error');
const moment = require('moment');
const ms = require('ms');
const VError = require('verror');

const Checks = require('@datenwelt/cargo-api').Checks;
const Mailer = require('@datenwelt/cargo-api').Mailer;
const Router = require('@datenwelt/cargo-api').Router;

const Schema = require('../../schema');

class AuthResetPasswordRouter extends Router {

	constructor(serverName, options) {
		super();
		options = Object.assign({schema: null, mailer: null}, options);
		this.serverName = serverName;
		this.schema = options.schema;
		this.mailer = options.mailer;
	}

	async init(config, state) {
		state = state || {};
		await super.init(config, state);

		if (!this.schema && !state.schema) {
			if (!config.db) throw new VError('Missing section "db" in API configuration.');
			state.schema = await new Schema().init(config.db);
		}
		this.schema = this.schema || state.schema;

		if (!this.mailer && config.smtp) {
			state.mailer = await new Mailer().init(config, state);
		}
		this.mailer = this.mailer || state.mailer;

		// eslint-disable-next-line new-cap
		const router = express.Router();

		router.post("/:token", Router.asyncRouter(async function (req, res, next) {
			const token = req.params.token;
			const password = req.body.password;
			try {
				let body = await this.resetPassword(token, password);
				res.status(200).send(body);
				return next();
			} catch (err) {
				if (err.name === 'HttpError') res.set('X-Error', err.message).status(err.code);
				else res.status(500);
				throw new VError(err, 'Unable to reset password with token "%s"', token);
			}
		}.bind(this)));

		router.post("/", Router.checkBodyField('username', {
			optional: false,
			type: 'string',
			notBlank: true
		}));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const username = req.body.username;
			try {
				let body = await this.createPasswordReset(username);
				res.status(200).send(body);
				return next();
			} catch (err) {
				if (err.name === 'HttpError') res.set('X-Error', err.message).status(err.code);
				else res.status(500);
				throw new VError(err, 'Unable to initiate password reset for user "%s"', username);
			}
		}.bind(this)));

		router.all('/', function (req, res, next) {
			if (!res.headersSent)
				res.sendStatus(405);
			next();
		});

		return router;
	}

	shutdown() {
		if (this.api) this.api.close();
		this.api = null;
	}

	async createPasswordReset(username, options) {
		options = Object.assign({expiresIn: '48h'}, options || {});
		const schema = this.schema.get();
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw new HttpError(400, 'ERR_REQ_USERNAME_UNKNOWN');
		if (!user.get('Active')) throw new HttpError(423, 'ERR_REQ_LOGIN_SUSPENDED');
		let token = schema.model('PasswordReset').createToken();
		let expiresAt = moment().add(ms(options.expiresIn));
		let passwordReset = await user.createPasswordReset({
			Token: token,
			ExpiresAt: expiresAt
		});
		let payload = Router.serialize(passwordReset.get());
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
			Checks.optional(false, token);
			Checks.type('string', token);
			Checks.notBlank(token);
		} catch (err) {
			if ( err.name === 'CargoCheckError' ) throw new HttpError(400, 'ERR_REQ_TOKEN_' + err.message);
			else throw new VError(err, 'Unable to check password reset token');
		}
		let passwordReset = await schema.model('PasswordReset').findById(token);
		if (!passwordReset) throw new HttpError(404, 'ERR_REQ_TOKEN_UNKNOWN');
		let expiresAt = moment(passwordReset.get('ExpiresAt'));
		if (moment().isAfter(expiresAt)) throw new HttpError(410, 'ERR_REQ_TOKEN_EXPIRED');
		let user = await schema.model('User').findById(passwordReset.get('UserId'));
		let username = user.get('Username');
		try {
			schema.model('User').checkPassword(password, [username]);
		} catch (err) {
			if ( err.name === 'CargoCheckError' ) throw new HttpError(400, 'ERR_BODY_PASSWORD_' + err.message);
			else throw new VError(err, 'Unable to check password in password reset');
		}
		password = schema.model('User').createPassword(password);
		user.set('Password', password);
		await user.save();
		passwordReset.destroy();
		let payload = {username: username};
		this.emit('password-reset', payload);
		return payload;
	}

}

module.exports = AuthResetPasswordRouter;
