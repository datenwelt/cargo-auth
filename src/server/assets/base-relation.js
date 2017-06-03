const _ = require('underscore');
const changecase = require('change-case');
const express = require('express');
const HttpError = require('standard-http-error');
const Promise = require('bluebird');
const VError = require('verror');
const format = require('util').format;

const Router = require('@datenwelt/cargo-api').Router;
const Schema = require('../../schema');

const UserModel = require('../../schema/user');

class UserGroupsRouter extends Router {

	constructor(serverName, modelName, options) {
		options = Object.assign({
			schema: null,
			sourceModelName: null,
			destinationModelName: null,
		}, options);
		super(serverName, options);
		this.schema = options.schema;
		this.modelName = modelName;
		this.sourceModelName = options.sourceModelName;
		this.destinationModelName = options.destinationModelName;
	}

	async init(config, state) {
		await super.init(config, state);
		if (!state.schema) state.schema = await new Schema().init(config.db);
		this.schema = state.schema;

		const sequelize = this.schema.get();
		const model = sequelize.model(this.modelName);
		this.primaryKey = model.primaryKeyAttributes;
		if (!this.primaryKey || this.primaryKey.length !== 2) throw new VError('Model %s has %d primary key fields but needs excactly 2 primary key columns to work with this module.', this.modelName, this.primaryKey.length);

		if (!this.sourceModelName) {
			let pk = this.primaryKey[0];
			[this.sourceModelName] = changecase.snakeCase(pk).split('_');
			this.sourceModelName = changecase.pascalCase(this.sourceModelName);
			if (!sequelize.models[this.sourceModelName]) throw new VError('Source model for %s was assumed to be %s, but no such model exists.', this.modelName, this.sourceModelName)
		}

		if (!this.destinationModelName) {
			let pk = this.primaryKey[1];
			[this.destinationModelName] = changecase.snakeCase(pk).split('_');
			this.destinationModelName = changecase.pascalCase(this.destinationModelName);
			if (!sequelize.models[this.destinationModelName]) throw new VError('Destination model for %s was assumed to be %s, but no such model exists.', this.modelName, this.sourceModelName)
		}

		this.sourcePrimaryKey = this.primaryKey.reduce(function (acc, fieldname) {
			if (fieldname.startsWith(this.sourceModelName)) return fieldname;
			return acc;
		}.bind(this), null);
		this.sourceParamName = changecase.camelCase(this.sourcePrimaryKey);
		this.sourcePath = sequelize.model(this.sourceModelName).tableName;
		this.sourcePath = changecase.snakeCase(this.sourcePath).replace('_', '-');

		this.destinationPrimaryKey = this.primaryKey.reduce(function (acc, fieldname) {
			if (fieldname.startsWith(this.destinationModelName)) return fieldname;
			return acc;
		}.bind(this), null);
		this.destinationParamName = changecase.camelCase(this.destinationPrimaryKey);
		this.destinationPath = sequelize.model(this.destinationModelName).tableName;
		this.destinationPath = changecase.snakeCase(this.destinationPath).replace('_', '-');

		this.describe = await sequelize.model(this.modelName).describe();
		this.optionalFields = [];
		this.fieldnames = Object.keys(this.describe).map(function (fieldname) {
			let column = this.describe[fieldname];
			if (column.allowNull) this.optionalFields.push(fieldname);
			return changecase.camelCase(fieldname);
		}.bind(this));

		this.app = express.Router();
		return this.app;
	}

	installGetRouter(defaultlListOptions) {
		defaultlListOptions = Object.assign({
			offset: 0,
			limit: 10
		}, defaultlListOptions);
		const sequelize = this.schema.get();
		let path = format("/%s/:%s/%s", this.sourcePath, this.sourceParamName, this.destinationPath);
		let predicateName = "check" + changecase.pascalCase(this.sourceParamName);
		let predicate = sequelize.model(this.modelName)[predicateName];
		if (!predicate) throw new VError('Missing class method %s() in module %s.', predicateName, this.modelName);
		this.app.get(path, Router.checkRequestParameter(this.sourceParamName, predicate));
		this.app.get(path, Router.createGenericListRouter(async function (listOptions, req) {
			const sequelize = this.schema.get();
			listOptions = Object.assign(defaultlListOptions, listOptions);
			let findOptions = {
				offset: listOptions.offset,
				limit: listOptions.limit
			};
			if (listOptions.orderBy && listOptions.orderBy.length) {
				if (_.isString(listOptions.orderBy)) listOptions.orderBy = [listOptions.orderBy];
				findOptions.order = _.map(listOptions.orderBy, function (orderDef) {
					let matches = orderDef.match(/^([A-Za-z0-9_]+)(?:,(asc|desc))$/);
					if (!matches) throw new HttpError(400, 'ERR_QUERY_ORDER_BY_INVALID');
					let fieldname = matches[1];
					let direction = matches[2];
					if (!direction) direction = 'asc';
					if (!_.contains(this.fieldnames, fieldname)) throw new HttpError(400, 'ERR_QUERY_ORDER_BY_UNKNOWNFIELD');
					return [changecase.pascalCase(fieldname), direction];
				}.bind(this));
			}
			let where = {};
			where[this.sourcePrimaryKey] = req.params[this.sourceParamName];
			findOptions.where = where;
			let instances = await sequelize.model(this.modelName).findAll(findOptions);
			let payload = await Promise.map(instances, async function (instance) {
				let destinationModel = sequelize.model(this.destinationModelName);
				let destinationKey = changecase.camelCase(this.destinationModelName);
				let destinationId = instance.get(this.destinationPrimaryKey);
				let destinationInstance = await destinationModel.findById(destinationId);
				let payload = Router.serialize(instance.get());
				let destinationPayload = Router.serialize(destinationInstance.get());
				payload[destinationKey] = destinationPayload;
				return payload;
			}.bind(this));
			return payload;
		}.bind(this)));
	}

	installPostRouter() {
		const sequelize = this.schema.get();
		let path = format("/%s/:%s/%s", this.sourcePath, this.sourceParamName, this.destinationPath);
		let predicateName = "check" + changecase.pascalCase(this.sourceParamName);
		let predicate = sequelize.model(this.modelName)[predicateName];
		if (!predicate) throw new VError('Missing class method %s() in module %s.', predicate, this.modelName);
		this.app.post(path, Router.checkRequestParameter(this.sourceParamName, predicate));
		_.chain(this.fieldnames).each(function (fieldname) {
			if (fieldname === this.sourceParamName) return;
			let predicateName = "check" + changecase.pascalCase(fieldname);
			let predicate = sequelize.model(this.modelName)[predicateName];
			if (!predicate) throw new VError('Missing class method %s() in module %s.', predicate, this.modelName);
			let isOptional = _.contains(this.optionalFields, fieldname);
			if (fieldname === this.destinationParamName) isOptional = true;
			this.app.post(path, Router.checkBodyField(fieldname, predicate, {isOptional: isOptional}));
		}.bind(this));
		this.app.post(path, Router.asyncRouter(async function (req, res, next) {
			const sequelize = this.schema.get();
			let sourceId = req.params[this.sourceParamName];
			let sourceInstance = await sequelize.model(this.sourceModelName).findById(sourceId);
			if (!sourceInstance) throw new HttpError(404, 'ERR_REQ_' + changecase.constant(this.sourcePrimaryKey) + "_UNKNOWN");
			let destinationId = req.body[this.destinationParamName];
			let destinationInstance = await sequelize.model(this.destinationModelName).findById(destinationId);
			if (!destinationInstance) throw new HttpError(404, 'ERR_REQ_' + changecase.constant(this.destinationPrimaryKey) + "_UNKNOWN");
			let fieldnames = _.intersection(this.fieldnames, Object.keys(req.body));
			let values = _.reduce(fieldnames, function (acc, fieldname) {
				if (fieldname === this.destinationParamName) return acc;
				if (fieldname === this.sourceParamName) return acc;
				let colName = changecase.pascalCase(fieldname);
				acc[colName] = req.body[fieldname];
				return acc;
			}.bind(this), {});
			values[this.sourcePrimaryKey] = sourceId;
			values[this.destinationPrimaryKey] = destinationId;
			let instance = await sequelize.model(this.modelName).create(values);
			let payload = Router.serialize(instance.get());
			let destinationPayload = Router.serialize(destinationInstance.get());
			let destinationKey = changecase.camelCase(this.destinationModelName);
			payload[destinationKey] = destinationPayload;
			res.status(200).send(payload);
			next();
		}.bind(this)));
	}

	installDeleteRouter() {
		const sequelize = this.schema.get();
		let path = format("/%s/:%s/%s/:%s", this.sourcePath, this.sourceParamName, this.destinationPath, this.destinationParamName);
		let predicateName = "check" + changecase.pascalCase(this.sourceParamName);
		let predicate = sequelize.model(this.modelName)[predicateName];
		if (!predicate) throw new VError('Missing class method %s() in module %s.', predicate, this.modelName);
		this.app.delete(path, Router.checkRequestParameter(this.sourceParamName, predicate));
		predicateName = "check" + changecase.pascalCase(this.destinationParamName);
		predicate = sequelize.model(this.modelName)[predicateName];
		if (!predicate) throw new VError('Missing class method %s() in module %s.', predicate, this.modelName);
		this.app.delete(path, Router.checkRequestParameter(this.destinationParamName, predicate));
		this.app.delete(path, Router.asyncRouter(async function (req, res, next) {
			const sequelize = this.schema.get();
			let sourceId = req.params[this.sourceParamName];
			let sourceInstance = await sequelize.model(this.sourceModelName).findById(sourceId);
			if (!sourceInstance) throw new HttpError(404, 'ERR_REQ_' + changecase.constant(this.sourcePrimaryKey) + "_UNKNOWN");
			let destinationId = req.params[this.destinationParamName];
			let where = {};
			where[this.sourcePrimaryKey] = sourceId;
			where[this.destinationPrimaryKey] = destinationId;
			await sequelize.model(this.modelName).destroy({where: where});
			res.sendStatus(200);
			next();
		}.bind(this)));

	}


}

module.exports = UserGroupsRouter;
