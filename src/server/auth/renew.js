const express = require('express');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;

class AuthRenewSessionRouter extends Router {

	constructor(serverName, api) {
		super();
		this.serverName = serverName;
		this.api = api;
	}

	async init(config, state) {
		await super.init(config, state);
		if (!this.api) throw new VError('AuthAPI not initialized.');
		const rsaPublicKey = this.api.rsa.rsaPublicKey;

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", Router.requiresToken(rsaPublicKey));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			try {
				const session = await this.api.renewSession(req.sessionId);
				return res.status(200).send(session);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.set('X-Cargo-Error', err.code);
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

	shutdown() {
		if (this.api) this.api.close();
		this.api = null;
	}

}


module.exports = AuthRenewSessionRouter;
