const express = require('express');
const moment = require('moment');
const ms = require('ms');
const HttpError = require('standard-http-error');
const VError = require('verror');

const Mailer = require('@datenwelt/cargo-api').Mailer;
const Router = require('@datenwelt/cargo-api').Router;

const Schema = require('../../schema');
const UserModel = require('../../schema/user');

class AuthRegisterRouter extends Router {

	constructor(serverName, options) {
		super();
		options = Object.assign({schema: null, mailer: null}, options);
		this.serverName = serverName;
		this.schema = options.schema;
		this.mailer = options.mailer;
	}

	async init(config, state) {
		state = state || {};
		await super.init(config, state);

		if (!this.schema && !state.schema) {
			if (!config.db) throw new VError('Missing section "db" in API configuration.');
			state.schema = await new Schema().init(config.db);
		}
		this.schema = this.schema || state.schema;

		if (!this.mailer && config.smtp) {
			state.mailer = await new Mailer().init(config, state);
		}
		this.mailer = this.mailer || state.mailer;

		// eslint-disable-next-line new-cap
		const router = express.Router();
		router.post("/", Router.checkBodyField('username', UserModel.checkUsername));
		router.post("/", Router.checkBodyField('password', UserModel.checkPassword, {optional: true}));
		router.post("/", Router.checkBodyField('email', UserModel.checkEmail, {optional: true}));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const username = req.body.username;
			delete req.body.username;
			const options = {};
			options.password = req.body.password;
			delete req.body.password;
			options.email = req.body.email;
			delete req.body.email;
			options.origin = req.body.origin;
			delete req.body.origin;
			options.extra = req.body;
			let activation = await this.registerUser(username, options);
			res.status(200).send(activation);
			return next();
		}.bind(this)));

		router.all('/', function (req, res, next) {
			if (!res.headersSent) res.sendStatus(405);
			next();
		});

		return router;
	}

	async registerUser(username, options) {
		options = Object.assign({expiresIn: '48h'}, options || {});
		const schema = this.schema.get();
		options.extra = options.extra || {};

		if (options.password && !options.password.match(/^\{.+\}.*/)) {
			options.password = schema.model('User').createPassword(options.password);
		}

		let user = await schema.model('User').findOne({where: {Username: username}});
		if (user) throw new HttpError(409, 'ERR_REQ_USERNAME_DUPLICATE');

		let activation = await schema.model('UserActivation').create({
			Id: schema.model('UserActivation').createId(),
			Username: username,
			Password: options.password,
			Email: options.email,
			Extra: JSON.stringify(options.extra),
			ExpiresAt: moment().add(ms(options.expiresIn)).toDate()
		});

		const payload = Router.serialize(activation.get());
		payload.token = payload.id;
		delete payload.id;
		payload.extra = JSON.parse(activation.Extra);
		delete payload.password;
		if (options.email && this.mailer) {
			await this.mailer.sendRegistration(payload);
			delete payload.token;
		}
		this.emit("register", payload);
		return payload;
	}

}

module.exports = AuthRegisterRouter;
