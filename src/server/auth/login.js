/* eslint-disable callback-return */
const crypto = require('crypto');
const express = require('express');
const HttpError = require('standard-http-error');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;
const RSA = require('@datenwelt/cargo-api').RSA;

const Schema = require('../../schema');

class AuthLoginRouter extends Router {

	constructor(serverName, options) {
		super();
		options = Object.assign({schema: null, rsa: null}, options);
		this.serverName = serverName;
		this.schema = options.schema;
		this.rsa = options.rsa;
	}

	async init(config, state) {
		await super.init(config, state);
		state = state || {};
		await super.init(config, state);

		if (!this.schema && !state.schema) {
			if (!config.db) throw new VError('Missing section "db" in API configuration.');
			state.schema = await new Schema().init(config.db);
		}
		this.schema = this.schema || state.schema;

		if (!this.rsa && !state.rsa) {
			state.rsa = await RSA.init(config.rsa);
		}
		this.rsa = this.rsa || state.rsa;

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", Router.checkBodyField('username', {
			optional: false,
			cast: 'string',
			transform: function (value) {
				return value.trim();
			},
			notBlank: true,
			minLength: 3,
			maxLength: 255,
		}));
		router.post("/", Router.checkBodyField('password', {
			optional: false,
			type: 'string',
			notBlank: true
		}));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const body = req.body;
			const username = body.username;
			const password = body.password;
			try {
				const session = await this.login(username, password);
				res.status(200).send(session);
				next();
			} catch (err) {
				if (err.name === 'HttpError') res.set('X-Error', err.message).status(err.code);
				else res.status(500);
				throw new VError(err, 'Unable to create login session for user "%s"', username);
			}
		}.bind(this)));

		router.all('/', function (req, res, next) {
			if (!res.headersSent)
				res.sendStatus(405);
			next();
		});

		return router;
	}

	async login(username, password, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		const schema = this.schema.get();
		const rsaPrivateKey = this.rsa.exportKey('private');

		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw new HttpError(403, 'ERR_REQ_LOGIN_FAILED');
		if (!user.get('Active')) {
			throw new HttpError(423, 'ERR_REQ_LOGIN_SUSPENDED');
		}
		let matches = (user.get('Password') || "").match(/^\{(SHA1|MD5|SHA256)\}(.+$)/);
		if (!matches) throw new VError('Unable to perform login for user "%s", password value does not start with "{SHA1|MD5|SHA256}"', username);
		const hash = crypto.createHash(matches[1]);
		hash.update(password);
		const hashed = hash.digest('hex');
		if (hashed.toLowerCase() !== matches[2].toLowerCase()) {
			throw new HttpError(403, 'ERR_REQ_LOGIN_FAILED');
		}
		let session = await schema.model('Session').createForUser(user, rsaPrivateKey, options);
		this.emit('login', session);
		return session;
	}

}

module.exports = AuthLoginRouter;
