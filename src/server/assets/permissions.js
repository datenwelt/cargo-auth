const _ = require('underscore');
const changecase = require('change-case');
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
		state = state || {};
		await super.init(config, state);
		if (!this.schema && !state.schema) {
			state.schema = await new Schema().init(config.db);
		}
		this.schema = this.schema || state.schema;

		// eslint-disable-next-line new-cap
		const router = express.Router();

		router.post("/", Router.checkBodyField('name', Permission.checkName));
		router.post("/", Router.checkBodyField('description', Permission.checkDescription));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			let permission = await this.createPermission(req.body.name, req.body.description);
			res.status(200).send(permission);
			return next();
		}.bind(this)));

		const listGenerator = await this.schema.createGenericListGenerator('Permission', {
			offset: 0,
			limit: 100,
			orderBy: 'name,asc'
		});
		router.get("/", Router.createGenericListRouter(listGenerator));

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

	async listPermissions(listOptions) {
		const schema = this.schema.get();
		if (!this.fieldNames) {
			let describe = await schema.model('Permission').describe();
			this.fieldNames = _.chain(describe).keys().map(function (col) {
				return changecase.camelCase(col);
			}).value();
		}
		listOptions.orderBy = listOptions.orderBy || 'name';
		if (!_.contains(this.fieldNames, listOptions.orderBy))
			throw new HttpError(400, 'ERR_QUERY_ORDER_BY_UNKOWNFIELD');
		let permissions = await schema.model('Permission').findAll({
			order: [[listOptions.orderBy, listOptions.orderDirection]],
			offset: listOptions.offset,
			limit: listOptions.limit
		});
		return _.map(permissions, (instance) => instance.get());
	}

	async shutdown() {
		await super.shutdown();
		if (this.schema) this.schema.close();
	}

}

module.exports = PermissionsRouter;
