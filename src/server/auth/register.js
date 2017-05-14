const express = require('express');
const Router = require('../../utils/router');
const VError = require('verror');

class AuthRegisterRouter extends Router {

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
			const username = req.body.username;
			delete req.body.username;
			try {
				const options = {};
				options.password = req.body.password;
				delete req.body.password;
				options.email = req.body.email;
				delete req.body.email;
				options.extra = req.body;
				let activation = await this.api.registerUser(username, options);
				return res.status(200).send(activation);
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
							return res.sendStatus(400);
						case 'ERR_USERNAME_ALREADY_PRESENT':
							return res.sendStatus(409);
						default:
							return res.sendStatus(500);
					}
				} else {
					res.sendStatus(500);
					throw new VError(err, 'Unable to register user "%s"', username);
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

module.exports = AuthRegisterRouter;
