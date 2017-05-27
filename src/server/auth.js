const express = require('express');

const Router = require('@datenwelt/cargo-api').Router;

const AuthActivateRouter = require('./auth/activate');
const AuthLoginRouter = require('./auth/login');
const AuthRegistrationRouter = require('./auth/register');
const AuthRenewSessionRouter = require('./auth/renew');

class AuthRouter extends Router {

	constructor(serverName) {
		super();
		this.serverName = serverName;
		this.routers = [];
	}

	async init(config, state) {
		await super.init(config, state);

		// eslint-disable-next-line new-cap
		const router = express.Router();
		const activateRouter = new AuthActivateRouter(this.serverName);
		this.routers.push(activateRouter);
		const loginRouter = new AuthLoginRouter(this.serverName);
		this.routers.push(loginRouter);
		const sessionRouter = new AuthRenewSessionRouter(this.serverName);
		this.routers.push(sessionRouter);
		const registrationRouter = new AuthRegistrationRouter(this.serverName);
		this.routers.push(registrationRouter);

		router.use('/activate', await activateRouter.init(config, state));
		router.use('/login', await loginRouter.init(config, state));
		router.use('/renew', await sessionRouter.init(config, state));
		router.use('/register', await registrationRouter.init(config, state));
		for ( let router of this.routers ) {
			router.onAny(function(...args) {
				this.emit(...args);
			}.bind(this));
		}
		return router;
	}

	shutdown() {
		this.routers.forEach(function(router) {
			router.shutdown();
		});
	}

}



module.exports = AuthRouter;
