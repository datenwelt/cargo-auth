const camelize = require('camelize');
const changecase = require('change-case');
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
				let activation = (await this.api.registerUser(username, options)).get();
				let responseBody = {};
				for ( let key of Object.keys(activation) ) {
					let value = activation[key];
					key = changecase.camelCase(key);
					responseBody[key] = value;
				}

				return res.status(200).send(responseBody);
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
