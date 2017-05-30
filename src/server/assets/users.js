const express = require('express');
const HttpError = require('standard-http-error');
const VError = require('verror');

const Router = require('@datenwelt/cargo-api').Router;

const Role = require('../../schema/role');
const Schema = require('../../schema');


class RolesRouter extends Router {

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

		router.post("/", Router.checkBodyField('name', Role.checkName));
		router.post("/", Router.checkBodyField('description', Role.checkDescription, {optional: true}));
		router.post("/", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let row = null;
			try {
				row = await schema.model('Role').create({
					Name: req.body.name,
					Description: req.body.description
				});
			} catch (err) {
				if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_ROLE_DUPLICATE');
				throw new VError(err);
			}
			let role = Router.serialize(row.get());
			res.status(200).send(role);
			return next();
		}.bind(this)));

		const listGenerator = await this.schema.createGenericListGenerator('Role', {
			offset: 0,
			limit: 100,
			orderBy: 'name,asc'
		});
		router.get("/", Router.createGenericListRouter(listGenerator));


		router.get("/:name", Router.checkRequestParameter('name', Role.checkName));
		router.get("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let row = await schema.model('Role').findById(req.params.name);
			if (!row) throw new HttpError(404, 'ERR_REQ_ROLE_UNKNOWN');
			let payload = Router.serialize(row.get());
			res.status(200).send(payload);
			next();
		}.bind(this)));

		router.delete("/:name", Router.checkRequestParameter('name', Role.checkName));
		router.delete("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			await schema.model('Role').destroy({where: {Name: req.params.name}});
			res.sendStatus(200);
			return next();
		}.bind(this)));

		router.put("/:name", Router.checkRequestParameter('name', Role.checkName));
		router.put("/:name", Router.checkBodyField('description', Role.checkDescription, {optional: true}));
		router.put("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let row = await schema.model('Role').findById(req.params.name);
			if (!row) throw new HttpError(404, 'ERR_REQ_ROLE_UNKNOWN');
			// eslint-disable-next-line no-undefined
			if (req.body.description !== undefined) {
				row.set('Description', req.body.description);
				await row.save();
			}
			let payload = Router.serialize(row.get());
			res.status(200).send(payload);
			next();
		}.bind(this)));

		router.post("/:name", Router.checkRequestParameter('name', Role.checkName));
		router.post("/:name", Router.checkBodyField('name', Role.checkName));
		router.post("/:name", Router.checkBodyField('description', Role.checkDescription, {optional: true}));
		router.post("/:name", Router.asyncRouter(async function (req, res, next) {
			const schema = this.schema.get();
			let row = await schema.model('Role').findById(req.params.name);
			if (!row) throw new HttpError(404, 'ERR_REQ_ROLE_UNKNOWN');
			let fields = {Name: req.body.name};
			// eslint-disable-next-line no-undefined
			if (req.body.description !== undefined) {
				fields.Description = req.body.description;
			}
			try {
				await schema.model('Role').update(fields, {
					where: {Name: req.params.name}
				});
			} catch (err) {
				if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_ROLE_DUPLICATE');
				throw new VError(err);
			}
			row = await schema.model('Role').findById(req.body.name);
			let payload = Router.serialize(row.get());
			res.status(200).send(payload);
			next();
		}.bind(this)));


		return router;
	}

	async shutdown() {
		await super.shutdown();
		if (this.schema) this.schema.close();
	}

}

module.exports = RolesRouter;
