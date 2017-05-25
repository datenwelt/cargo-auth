const express = require('express');
const HttpError = require('standard-http-error');
const moment = require('moment');
const VError = require('verror');

const Checks = require('@datenwelt/cargo-api').Checks;
const Router = require('@datenwelt/cargo-api').Router;
const RSA = require('@datenwelt/cargo-api').RSA;

const Schema = require('../../schema');

class AuthRenewSessionRouter extends Router {

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
		router.post("/", Router.checkSessionToken(this.rsa.rsaPublicKey));
		router.post("/", Router.requiresAuthentication());
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			try {
				const session = await this.renewSession(req.sessionId);
				return res.status(200).send(session);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.append('X-Error', err.code);
					switch (err.code) {
						case 'ERR_SESSION_ID_INVALID':
						case 'ERR_SESSION_ID_MISSING':
							return res.sendStatus(400);
						case 'ERR_SESSION_EXPIRED':
							return res.sendStatus(410);
						case 'ERR_LOGIN_SUSPENDED':
							return res.sendStatus(423);
						case 'ERR_UNKNOWN_USER':
						case 'ERR_UNKNOWN_SESSION':
							return res.sendStatus(403);
						default:
							return res.sendStatus(500);
					}
				} else {
					res.sendStatus(500);
					throw new VError(err, 'Unable to renew session "%s"', req.sessionId);
				}
			} finally {
				// eslint-disable-next-line callback-return
				next();
			}
		}.bind(this)));

		router.all('/', function (req, res, next) {
			if (!res.headersSent)
				res.sendStatus(405);
			next();
		});

		return router;
	}

	async renewSession(sessionId, options) {
		options = Object.assign({
			validFor: '4h'
		}, options || {});
		try {
			Checks.optional(false, sessionId);
			Checks.type('string', sessionId);
			Checks.notBlank(sessionId);
		} catch (err) {
			if (err.name === 'CargoCheckError')
				throw new HttpError(400, 'ERR_REQ_SESSION_' + err.message);
			throw err;
		}
		const schema = this.schema.get();
		const rsaPrivateKey = this.rsa.rsaPrivateKey;

		let session = await schema.model('Session').findById(sessionId);
		if (!session) throw new HttpError(400, 'ERR_REQ_SESSION_UNKNOWN');

		let exp = moment(session.get('ExpiresAt'));
		let now = moment();
		if (exp.isBefore(now)) throw new HttpError(410, 'ERR_REQ_SESSION_EXPIRED');
		let username = session.get('Username');
		let user = await schema.model('User').findOne({where: {Username: username}});
		if (!user) throw new HttpError(403, 'ERR_REQ_USER_UNKNOWN');
		if (!user.get('Active')) {
			throw new HttpError(423, 'ERR_REQ_LOGIN_SUSPENDED');
		}
		session = await schema.model('Session').createForUser(user, rsaPrivateKey, options);
		this.emit('login', session);
		return session;
	}

}


module.exports = AuthRenewSessionRouter;
