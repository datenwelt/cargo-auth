const express = require('express');
const HttpError = require('standard-http-error');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;

const Permission = require('../../schema/permission');
const Schema = require('../../schema');


class PermissionsRouter extends Router {

	constructor(serverName, options) {
		super(serverName);
		options = options || {};
		this.schema = options.schema;
	}

	async init(config, state) {
		if (!this.schema && !state.schema) {
			state.schema = await new Schema().init(config.db);
		}
		this.schema = state.schema;

		// eslint-disable-next-line new-cap
		const router = express.Router();

		router.post("/", Router.checkBodyField('name', { check: Permission.checkNameInput }));
		router.post("/", Router.checkBodyField('description', {
			optional: true,
			cast: 'string'
		}));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			let permission = await this.createPermission(req.body.name, req.body.description);
			res.status(200).send(permission);
			return next();
		}.bind(this)));

		return router;
	}

	async createPermission(name, description) {
		const schema = this.schema.get();
		let row = null;
		try {
			row = await schema.model('Permission').create({
				Name: name,
				Description: description
			});
		} catch (err) {
			if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_PERMISSION_DUPLICATE');
			throw new VError(err);
		}
		let permission = Router.serialize(row.get());
		this.emit('permission.create', permission);
		return permission;
	}

	shutdown() {
		this.schema.close();
	}

}

module.exports = PermissionsRouter;
