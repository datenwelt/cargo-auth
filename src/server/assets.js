const express = require('express');
const HttpError = require('standard-http-error');
const URI = require('urijs');

const Router = require('@datenwelt/cargo-api').Router;
const RSA = require('@datenwelt/cargo-api').RSA;
const Schema = require('../schema');

const PermissionRouter = require('./assets/permissions');

class AuthAssetsRouter extends Router {

	constructor(serverName, options) {
		super();
		options = Object.assign({schema: null, rsa: null}, options || {});
		this.serverName = serverName;
		this.routers = [];
		this.schema = options.schema;
		this.rsa = options.rsa;
	}

	async init(config, state) {
		state = state || {};
		await super.init(config, state);

		// eslint-disable-next-line new-cap
		const router = express.Router();
		if (!this.schema && !state.schema) {
			state.schema = await new Schema().init(config.db);
		}
		this.schema = this.schema || state.schema;
		this.schema.get().model('Permission').findOrCreate({
			where: {
				Name: 'auth-admin'
			},
			defaults: {
				Name: 'auth-admin',
				Description: 'Can create, change or remove authorizazion assets like Users, Groups.'
			}
		});

		if (!this.rsa && !state.rsa) {
			state.rsa = RSA.init(config.rsa);
		}
		this.rsa = this.rsa || state.rsa;

		const permRouter = new PermissionRouter(this.serverName);
		this.routers.push(permRouter);

		router.use("*", Router.requireSessionToken(this.rsa.rsaPublicKey));
		router.use("*", this.requireAdminPermission());

		router.use("/permissions", await permRouter.init(config, state));

		this.routers.forEach(function (router) {
			router.onAny(function (...args) {
				this.emit(...args);
			}.bind(this));
		}.bind(this));

		return router;
	}

	shutdown() {
		this.routers.forEach(function (router) {
			router.shutdown();
		});
	}

	requireAdminPermission() {
		return Router.asyncRouter(async function (req, res, next) {
				const schema = this.schema.get();
				let session = await schema.model('Session').findById(req.sessionId);
				if (!session) throw new HttpError(403, 'ERR_REQ_SESSION_UNKNOWN');
				let user = await schema.model('User').findOne({where: {Username: session.get('Username')}});
				if (!user) throw new HttpError(403, 'ERR_REQ_USER_UNKNOWN');
				if (!user.get('Active')) throw new HttpError(423, 'ERR_REQ_USER_SUSPENDED');
				let origin = req.get('Origin') || req.get('Referer');
				if (!origin) throw new HttpError(400, 'ERR_HEADER_ORIGIN_MISSING');
				let originHost = null;
				try {
					if (!origin.match(/^http(s?):\/\//)) {
						originHost = origin;
					} else {
						originHost = new URI(origin).hostname();
					}
				} catch (err) {
					throw new HttpError(400, 'ERR_HEADER_ORIGIN_INVALID');
				}
				let userPermissions = await user.permissions();
				let permissions = userPermissions[originHost];
				if (!permissions) throw new HttpError(403, 'ERR_REQ_ORIGIN_UNKNOWN');
				if (!permissions.includes('auth-admin'))
					throw new HttpError(403, 'ERR_REQ_PERMISSION_FAILED');
				next();
			}.bind(this)
		);
	}

}

module.exports = AuthAssetsRouter;
