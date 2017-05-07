/* eslint-disable callback-return */
const express = require('express');
const VError = require('verror');

const AuthAPI = require('../../api/auth');
const Router = require('../../utils/router');

class AuthLoginRouter extends Router {

	constructor(serverName) {
		super();
		this.serverName = serverName;
		this.api = null;
	}

	async init(config, state) {
		const apiName = this.serverName + ".auth";
		try {
			if (state && state.apis && state.apis[this.name]) {
				this.api = state.apis[apiName];
			} else {
				this.api = await new AuthAPI(this.name).init(config, state);
			}
		} catch (err) {
			throw new VError(err, 'Unable to initialize new instance of AuthAPI');
		}

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", this.route(async function (req, res, next) {
			const body = req.body;
			try {
				const session = await this.api.login(body.username, body.password);
				return res.send(200, session);
			} catch (err) {
				if (err.name === 'CargoModelError') {
					res.set('X-cargo-error', err.code);
					switch (err.code) {
						case 'ERR_USERNAME_INVALID':
						case 'ERR_PASSWORD_INVALID':
						case 'ERR_USERNAME_MISSING':
						case 'ERR_PASSWORD_MISSING':
							return res.sendStatus(400);
						case 'ERR_UNKNOWN_USER':
							return res.sendStatus(400);
						case 'ERR_LOGIN_SUSPENDED':
							return res.sendStatus(503);
						case 'ERR_LOGIN_FAILED':
							return res.sendStatus(403);
						default:
							return res.sendStatus(500);
					}
				} else {
					throw new VError(err, 'Unable to perform login for user "%s"', body.username);
				}
			} finally {
				next();
			}
		}.bind(this)));

		router.all('/', function (req, res, next) {
			if (!res.headersSent)
				res.sendStatus(405);
			next();
		});

		if (state) {
			state.routers = state.routers || [];
			state.routers.push(this);
		}

		return router;
	}

	shutdown() {
		if (this.api) this.api.close();
		this.api = null;
	}

}

module.exports = AuthLoginRouter;
