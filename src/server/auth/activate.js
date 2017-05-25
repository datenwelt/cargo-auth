const express = require('express');
const HttpError = require("standard-http-error");
const moment = require('moment');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;
const Schema = require('../../schema');

class AuthActivateRouter extends Router {

	constructor(serverName, options) {
		super();
		options = Object.assign({schema: null}, options);
		this.serverName = serverName;
		this.schema = options.schema;
	}

	async init(config, state) {
		state = state || {};
		await super.init(config, state);

		if (!state.schema) {
			if (!config.db) throw new VError('Missing section "db" in API configuration.');
			state.schema = await new Schema().init(config.db);
		}
		this.schema = state.schema;

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", Router.checkBodyField('token', {
			cast: 'string',
			transform: function (value) {
				return value.trim();
			},
			notBlank: true,
			minLength: 40,
			maxLength: 40
		}));
		router.post("/", Router.checkBodyField('password', {
			optional: true,
			type: 'string',
			notBlank: true,
			minLength: 6,
			maxLength: 40
		}));
		router.post("/", Router.checkBodyField('email', {
			optional: true,
			cast: 'string',
			transform: function (value) {
				return value.trim();
			},
			notBlank: true,
			minLength: 3,
			maxLength: 255
		}));
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
				let user = await this.activateUser(token, options);
				res.status(200).send(user);
				return next();
			} catch (err) {
				if (err.name === 'HttpError') res.set('X-Error', err.message).status(err.code);
				else res.status(500);
				throw new VError(err, 'Unable to activate user by token "%s"', token);
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

	async activateUser(token, options) {
		// Check if token exists and is not expired yet.
		const schema = this.schema.get();
		let activation = await schema.model('UserActivation').findById(token);
		if (!activation) throw new HttpError(404, 'ERR_BODY_TOKEN_UNKOWN');
		let expiresAt = moment(activation.get('ExpiresAt'));
		if (moment().isAfter(expiresAt)) throw new HttpError(410, 'ERR_BODY_TOKEN_EXPIRED');

		const username = activation.get('Username');
		const password = options.password || activation.get('Password');
		const email = options.email || activation.get('Email');

		let extra = activation.get('Extra');
		if (extra) extra = JSON.parse(extra);
		extra = Object.assign({}, extra, options.extra);

		if (!password) throw new HttpError(400, 'ERR_REQ_PASSWORD_MISSING');
		if (!email) throw new HttpError(400, 'ERR_REQ_EMAIL_MISSING');
		let user = await schema.model('User').findOne({where: {Username: username}});
		schema.model('User').checkPassword(password, [username]);
		if (user) throw new HttpError(409, 'ERR_REQ_USERNAME_DUPLICATE');
		user = await schema.model('User').create({
			Username: username,
			Password: password,
			Email: email,
			Active: true
		});
		await activation.destroy();
		const payload = Router.serialize(user.get());
		delete payload.password;
		payload.extra = extra;
		this.emit("activate", payload);
		return payload;
	}

}

module.exports = AuthActivateRouter;
