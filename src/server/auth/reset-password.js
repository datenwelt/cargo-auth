const express = require('express');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;

class AuthResetPasswordRouter extends Router {

	constructor(serverName, api) {
		super();
		this.serverName = serverName;
		this.api = api;
	}

	async init(config, state) {
		await super.init(config, state);
		if (!this.api) throw new VError('AuthAPI not initialized.');
		if (config.server && config.server.errorHeader) this.errorHeader = config.server.errorHeader;

		// eslint-disable-next-line new-cap
		const router = express.Router();

		router.post("/:token", Router.asyncRouter(async function (req, res, next) {
			const token = req.params.token;
			const password = req.body.password;
			try {
				let body = await this.api.resetPassword(token, password);
				return res.status(200).send(body);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.set(this.errorHeader, err.code);
					switch (err.code) {
						case 'ERR_TOKEN_INVALID':
						case 'ERR_TOKEN_MISSING':
							return res.sendStatus(400);
						case 'ERR_TOKEN_UNKNOWN':
							return res.sendStatus(404);
						case 'ERR_TOKEN_EXPIRED':
							return res.sendStatus(410);
						default:
							if (err.code.match(/^ERR_PASSWORD_/)) return res.sendStatus(400);
							return res.sendStatus(501);
					}
				} else {
					res.sendStatus(500);
					throw new VError(err, 'Unable to reset password with token "%s"', token);
				}
			} finally {
				// eslint-disable-next-line callback-return
				next();
			}
		}.bind(this)));

		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const username = req.body.username;
			try {
				let body = await this.api.createPasswordReset(username);
				return res.status(200).send(body);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.set(this.errorHeader, err.code);
					switch (err.code) {
						case 'ERR_USERNAME_INVALID':
						case 'ERR_USERNAME_MISSING':
						case 'ERR_USERNAME_UNKNOWN':
							return res.sendStatus(400);
						case 'ERR_USERNAME_SUSPENDED':
							return res.sendStatus(423);
						default:
							return res.sendStatus(500);
					}
				} else {
					res.sendStatus(500);
					throw new VError(err, 'Unable to create password reset request user "%s"', username);
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

module.exports = AuthResetPasswordRouter;
