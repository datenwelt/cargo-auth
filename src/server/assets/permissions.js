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
		router.post("/", Router.checkBodyField('description', Permission.checkDescription, {optional: true}));
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


		router.get("/:name", Router.checkRequestParameter('name', Permission.checkName));
		router.get("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let permission = await schema.model('Permission').findById(req.params.name);
			if (!permission)throw new HttpError(404, 'ERR_REQ_PERMISSION_UNKNOWN');
			let payload = Router.serialize(permission.get());
			res.status(200).send(payload);
			next();
		}.bind(this)));

		router.delete("/:name", Router.checkRequestParameter('name', Permission.checkName));
		router.delete("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			await schema.model('Permission').destroy({where: {Name: req.params.name}});
			res.sendStatus(200);
			return next();
		}.bind(this)));

		router.put("/:name", Router.checkRequestParameter('name', Permission.checkName));
		router.put("/:name", Router.checkBodyField('description', Permission.checkDescription, {optional: true}));
		router.put("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let permission = await schema.model('Permission').findById(req.params.name);
			if (!permission) throw new HttpError(404, 'ERR_REQ_PERMISSION_UNKNOWN');
			// eslint-disable-next-line no-undefined
			if (req.body.description !== undefined) {
				permission.set('Description', req.body.description);
				await permission.save();
			}
			let payload = Router.serialize(permission.get());
			res.status(200).send(payload);
			next();
		}.bind(this)));

		router.post("/:name", Router.checkRequestParameter('name', Permission.checkName));
		router.post("/:name", Router.checkBodyField('name', Permission.checkName));
		router.post("/:name", Router.checkBodyField('description', Permission.checkDescription, {optional: true}));
		router.post("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let permission = await schema.model('Permission').findById(req.params.name);
			if (!permission) throw new HttpError(404, 'ERR_REQ_PERMISSION_UNKNOWN');
			let fields = {Name: req.body.name};
			// eslint-disable-next-line no-undefined
			if (req.body.description !== undefined) {
				fields.Description = req.body.description;
			}
			try {
				await schema.model('Permission').update(fields, {
					where: {Name: req.params.name}
				});
			} catch (err) {
				if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_PERMISSION_DUPLICATE');
				throw new VError(err);
			}
			permission = await schema.model('Permission').findById(req.body.name);
			let payload = Router.serialize(permission.get());
			res.status(200).send(payload);
			next();
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

	async shutdown() {
		await super.shutdown();
		if (this.schema) this.schema.close();
	}

}

module.exports = PermissionsRouter;
