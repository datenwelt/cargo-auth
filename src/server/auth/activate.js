const express = require('express');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;

class AuthActivateRouter extends Router {

	constructor(serverName, api) {
		super();
		this.serverName = serverName;
		this.api = api;
	}

	async init(config, state) {
		await super.init(config, state);
		if (!this.api) throw new VError('AuthAPI not initialized.');

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const token = req.body.token;
			delete req.body.token;
			try {
				const options = {};
				options.password = req.body.password;
				delete req.body.password;
				options.email = req.body.email;
				delete req.body.email;
				options.extra = req.body;
				let user = await this.api.activateUser(token, options);
				return res.status(200).send(user);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.set('X-Cargo-Error', err.code);
					switch (err.code) {
						case 'ERR_USERNAME_INVALID':
						case 'ERR_USERNAME_MISSING':
						case 'ERR_USERNAME_TOO_SHORT':
						case 'ERR_USERNAME_TOO_LONG':
						case 'ERR_PASSWORD_INVALID':
						case 'ERR_PASSWORD_MISSING':
						case 'ERR_PASSWORD_TOO_SHORT':
						case 'ERR_PASSWORD_TOO_LONG':
						case 'ERR_PASSWORD_TOO_WEAK':
						case 'ERR_EMAIL_INVALID':
						case 'ERR_EMAIL_MISSING':
						case 'ERR_TOKEN_INVALID':
						case 'ERR_TOKEN_MISSING':
							return res.sendStatus(400);
						case 'ERR_TOKEN_UNKOWN':
							return res.sendStatus(404);
						case 'ERR_USERNAME_ALREADY_PRESENT':
							return res.sendStatus(409);
						case 'ERR_TOKEN_EXPIRED':
							return res.sendStatus(410);
						default:
							return res.sendStatus(500);
					}
				} else {
					res.sendStatus(500);
					throw new VError(err, 'Unable to activate user by token "%s"', token);
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

module.exports = AuthActivateRouter;
