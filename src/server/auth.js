const express = require('express');
const VError = require('verror');

const AuthAPI = require('../api/auth');
const AuthLoginRouter = require('./auth/login');
const AuthRegistrationRouter = require('./auth/register');
const AuthRenewSessionRouter = require('./auth/renew');
const Router = require('../utils/router');

class AuthRouter extends Router {

	constructor(serverName) {
		super();
		this.serverName = serverName;
		this.api = null;
	}

	async init(config, state) {
		await super.init(config, state);
		const apiName = this.serverName + ".auth";
		try {
			if (state && state.apis && state.apis[this.name]) {
				this.api = state.apis[apiName];
			} else {
				this.api = await new AuthAPI(apiName).init(config, state);
			}
		} catch (err) {
			throw new VError(err, 'Unable to initialize new instance of AuthAPI');
		}


		// eslint-disable-next-line new-cap
		const router = express.Router();
		const loginRouter = await new AuthLoginRouter(this.serverName, this.api).init(config, state);
		const sessionRouter = await new AuthRenewSessionRouter(this.serverName, this.api).init(config, state);
		const registrationRouter = await new AuthRegistrationRouter(this.serverName, this.api).init(config, state);
		router.use('/login', loginRouter);
		router.use('/renew', sessionRouter);
		router.use('/register', registrationRouter);
		return router;
	}

}

module.exports = AuthRouter;
