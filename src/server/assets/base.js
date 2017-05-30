/* eslint-disable id-length */
const _ = require('underscore');
const changecase = require('change-case');
const express = require('express');
const HttpError = require('standard-http-error');
const VError = require('verror');

const Schema = require('../../schema');
const Router = require('@datenwelt/cargo-api').Router;


class AssetsBaseRouter extends Router {

	constructor(serverName, modelName, options) {
		options = Object.assign({
			schema: null,
			autoPrimaryKey: false
		}, options);
		super();
		this.modelName = modelName;
		this.serverName = serverName;
		this.schema = options.schema;
		this.autoPrimaryKey = options.autoPrimaryKey;
	}

	async init(config, state = {}) {
		await super.init(config, state);
		if (!state.schema) state.schema = await new Schema().init(config.db);
		this.schema = state.schema;

		const sequelize = this.schema.get();
		this.describe = await sequelize.model(this.modelName).describe();
		this.fieldnames = Object.keys(this.describe).map((key) => changecase.camelCase(key));
		this.optionalFields = Object.keys(this.describe).filter((key) => this.describe[key].allowNull, this);
		this.primaryKey = Object.keys(this.describe).filter((key) => this.describe[key].primaryKey, this);
		if (this.primaryKey.length === 0) throw new VError('Model %s has no primary key and cannot be used with class AssetsBaseRouter.', this.modelName);
		if (this.primaryKey.length > 1) throw new VError('Model %s has more than one primary key and cannot be used with class AssetsBaseRouter.', this.modelName);
		this.primaryKey = changecase.camelCase(this.primaryKey[0]);
		// eslint-disable-next-line new-cap
		this.app = express.Router();
		return this.app;
	}

	async installGetRouter(listOptions) {
		listOptions = Object.assign({
			offset: 0,
			limit: 100,
			orderBy: this.primaryKey + ",asc"
		}, listOptions);
		// eslint-disable-next-line no-undefined
		let listGenerator = await this.schema.createGenericListGenerator(this.modelName, listOptions);
		this.app.get('/', Router.createGenericListRouter(listGenerator));
	}

	installPostRouter() {
		const model = this.schema.get().model(this.modelName);
		this.fieldnames.forEach(function (fieldname) {
			let predicateName = "check" + changecase.pascalCase(fieldname);
			let predicate = model[predicateName];
			if (!predicate || typeof predicate !== 'function') return;
			let isOptional = this.optionalFields.includes(fieldname);
			if (fieldname === this.primaryKey && this.autoPrimarykey) isOptional = true;
			this.app.post("/", Router.checkBodyField(fieldname, predicate, {optional: isOptional}));
		}, this);
		this.app.post("/", Router.asyncRouter(async function (req, res, next) {
			const model = this.schema.get().model(this.modelName);
			let fields = _.intersection(this.fieldnames, Object.keys(req.body));
			let values = fields.reduce(function (acc, fieldname) {
				let value = req.body[fieldname];
				let column = changecase.pascalCase(fieldname);
				acc[column] = value;
				return acc;
			}, {});
			fields = fields.map((fieldname) => changecase.pascalCase(fieldname));
			let instance = null;
			try {
				instance = await model.create(values, {fields: fields});
			} catch (err) {
				if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_' + changecase.constantCase(this.modelName) + '_DUPLICATE')
				throw new VError(err);
			}
			let payload = Router.serialize(instance.get());
			res.status(200).send(payload);
			return next();
		}.bind(this)));
	}

	installGetItemRouter() {
		const model = this.schema.get().model(this.modelName);
		const path = "/:" + this.primaryKey;
		let predicateName = "check" + changecase.pascalCase(this.primaryKey);
		let predicate = model[predicateName];
		if (!predicate || typeof predicate !== 'function') throw new VError('Missing class method %s() to check request parameter %s.', predicateName, this.primaryKey);
		this.app.get(path, Router.checkRequestParameter(this.primaryKey, predicate));
		this.app.get(path, Router.asyncRouter(async function (req, res, next) {
			const model = this.schema.get().model(this.modelName);
			const column = changecase.pascalCase(this.primaryKey);
			let where = {};
			where[column] = req.params[this.primaryKey];
			let row = await model.findOne({where: where});
			if (!row) throw new HttpError(404, 'ERR_REQ_' + changecase.constantCase(this.modelName) + "_UNKNOWN");
			let payload = Router.serialize(row.get());
			res.status(200).send(payload);
			return next();
		}.bind(this)));

	}

	installPostItemRouter() {
		const model = this.schema.get().model(this.modelName);
		const path = "/:" + this.primaryKey;
		let predicateName = "check" + changecase.pascalCase(this.primaryKey);
		let predicate = model[predicateName];
		if (!predicate || typeof predicate !== 'function') throw new VError('Missing class method %s() to check request parameter %s.', predicateName, this.primaryKey);
		this.app.get(path, Router.checkRequestParameter(this.primaryKey, predicate));
		this.fieldnames.forEach(function (fieldname) {
			let predicateName = "check" + changecase.pascalCase(fieldname);
			let predicate = model[predicateName];
			if (!predicate || typeof predicate !== 'function') return;
			this.app.post(path, Router.checkBodyField(fieldname, predicate, {optional: true}));
		}, this);
		this.app.post(path, Router.asyncRouter(async function (req, res, next) {
			const model = this.schema.get().model(this.modelName);
			let instanceId = req.params[this.primaryKey];
			let where = {};
			where[changecase.pascalCase(this.primaryKey)] = instanceId;
			let instance = await model.findOne({where: where});
			if (!instance) throw new HttpError(404, 'ERR_REQ_' + changecase.constantCase(this.modelName) + "_UNKNOWN");
			let fields = _.intersection(this.fieldnames, Object.keys(req.body));
			if (!fields || !fields.length) {
				let payload = Router.serialize(instance.get());
				res.status(200).send(payload);
				return next();
			}
			let values = fields.reduce(function (acc, fieldname) {
				let value = req.body[fieldname];
				let column = changecase.pascalCase(fieldname);
				acc[column] = value;
				return acc;
			}, {});
			fields = fields.map((fieldname) => changecase.pascalCase(fieldname));
			try {
				await model.update(values, {where: where, fields: fields});
			} catch (err) {
				if (err.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'ERR_REQ_' + changecase.constantCase(this.modelName) + '_DUPLICATE')
				throw new VError(err);
			}
			// eslint-disable-next-line no-undefined
			if (req.body[this.primaryKey] !== undefined) instanceId = req.body[this.primaryKey];
			instance = await model.findById(instanceId);
			let payload = Router.serialize(instance.get());
			res.status(200).send(payload);
			return next();
		}.bind(this)));
	}

	installPutItemRouter() {
		const model = this.schema.get().model(this.modelName);
		const path = "/:" + this.primaryKey;
		let predicateName = "check" + changecase.pascalCase(this.primaryKey);
		let predicate = model[predicateName];
		if (!predicate || typeof predicate !== 'function') throw new VError('Missing class method %s() to check request parameter %s.', predicateName, this.primaryKey);
		this.app.put(path, Router.checkRequestParameter(this.primaryKey, predicate));
		this.fieldnames.forEach(function (fieldname) {
			if ( fieldname === this.primaryKey) return;
			let predicateName = "check" + changecase.pascalCase(fieldname);
			let predicate = model[predicateName];
			if (!predicate || typeof predicate !== 'function') return;
			let isOptional = this.optionalFields.includes(fieldname);
			if (fieldname === this.primaryKey && this.autoPrimarykey) isOptional = true;
			this.app.put(path, Router.checkBodyField(fieldname, predicate, {optional: isOptional}));
		}, this);
		this.app.put(path, Router.asyncRouter(async function (req, res, next) {
			const model = this.schema.get().model(this.modelName);
			let instanceId = req.params[this.primaryKey];
			let where = {};
			where[changecase.pascalCase(this.primaryKey)] = instanceId;
			let instance = await model.findOne({where: where});
			if (!instance) throw new HttpError(404, 'ERR_REQ_' + changecase.constantCase(this.modelName) + "_UNKNOWN");
			this.fieldnames.forEach(function (fieldname) {
				if (fieldname === this.primaryKey) return;
				let colname = changecase.pascalCase(fieldname);
				let value = req.body[fieldname];
				// eslint-disable-next-line no-undefined
				if ( value === undefined ) value = null;
				instance.set(colname, value);
			}, this);
			await instance.save();
			let payload = Router.serialize(instance.get());
			res.status(200).send(payload);
			return next();
		}.bind(this)));
	}

	installDeleteItemRouter() {
		const model = this.schema.get().model(this.modelName);
		const path = "/:" + this.primaryKey;
		let predicateName = "check" + changecase.pascalCase(this.primaryKey);
		let predicate = model[predicateName];
		if (!predicate || typeof predicate !== 'function') throw new VError('Missing class method %s() to check request parameter %s.', predicateName, this.primaryKey);
		this.app.delete(path, Router.checkRequestParameter(this.primaryKey, predicate));
		this.app.delete(path, Router.asyncRouter(async function (req, res, next) {
			const model = this.schema.get().model(this.modelName);
			const column = changecase.pascalCase(this.primaryKey);
			let where = {};
			where[column] = req.params[this.primaryKey];
			await model.destroy({where: where});
			res.sendStatus(200);
			return next();
		}.bind(this)));
	}


}

module.exports = AssetsBaseRouter;
