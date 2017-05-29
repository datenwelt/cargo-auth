/* eslint-disable global-require,id-length */
const Sequelize = require('sequelize');
const _ = require('underscore');
const changecase = require('change-case');
const HttpError = require('standard-http-error');

class Schema {

	constructor() {
		this.sequelize = null;
	}

	async init(config, options) {
		if (this.sequelize) return this.sequelize;
		options = Object.assign({
			drop: false,
			sync: false
		}, options || {});

		config.database = config.database || 'cargo_auth';
		config.username = config.username || 'cargo';

		config.options = config.options || {};

		this.sequelize = new Sequelize(config.database, config.username, config.password, {
			dialect: config.type || 'mysql',
			host: config.hostname,
			port: config.port,
			dialectOptions: config.options,
			define: {
				timestamps: false
			},
			timezone: 'Europe/Berlin',
			logging: false,
			pool: true
		});

		await this.defineStructure();
		if (options.drop) await this.sequelize.dropAllSchemas();
		await this.sequelize.sync({force: options.force});
		await this.defineData();
		return this;
	}

	defineStructure() {
		const sequelize = this.sequelize;

		require('./schema/group').define(sequelize);
		require('./schema/group-permission').define(sequelize);
		require('./schema/group-role').define(sequelize);
		require('./schema/origin').define(sequelize);
		require('./schema/password-reset').define(sequelize);
		require('./schema/permission').define(sequelize);
		require('./schema/permission-bitmap').define(sequelize);
		require('./schema/role').define(sequelize);
		require('./schema/role-permission').define(sequelize);
		require('./schema/session').define(sequelize);
		require('./schema/system').define(sequelize);
		require('./schema/user').define(sequelize);
		require('./schema/user-activation').define(sequelize);
		require('./schema/user-group').define(sequelize);
		require('./schema/user-role').define(sequelize);
		require('./schema/user-origin').define(sequelize);
		require('./schema/user-permission').define(sequelize);

		const model = sequelize.model.bind(sequelize);

		model('Origin').hasMany(model('Group'));

		model('Role').belongsToMany(model('Permission'), {through: model('RolePermission')});

		model('Group').belongsToMany(model('Permission'), {through: model('GroupPermission')});
		model('Group').belongsToMany(model('Role'), {through: model('GroupRole')});

		model('User').hasMany(model('PasswordReset'));
		model('User').belongsToMany(model('Origin'), {through: model('UserOrigin')});
		model('UserOrigin').belongsToMany(model('Group'), {through: model('UserGroup')});
		model('UserOrigin').belongsToMany(model('Role'), {through: model('UserRole'), foreignKey: 'UserOriginId'});
		model('UserOrigin').belongsToMany(model('Permission'), {
			through: model('UserPermission'),
			foreignKey: 'UserOriginId'
		});
	}

	// eslint-disable-next-line class-methods-use-this
	defineData() {
	}

	get() {
		return this.sequelize;
	}

	async createGenericListGenerator(model, defaultListOptions) {
		let description = await this.sequelize.model(model).describe();
		let fieldnames = _.chain(description).keys().map((col) => changecase.camelCase(col)).value();
		defaultListOptions = Object.assign({offset: 0, limit: 10}, defaultListOptions);
		description = null;
		return async function (refListOptions) {
			let listOptions = Object.assign({}, defaultListOptions, refListOptions);
			let findOptions = {
				offset: listOptions.offset,
				limit: listOptions.limit
			};
			if (listOptions.orderBy && listOptions.orderBy.length) {
				if ( _.isString(listOptions.orderBy)) listOptions.orderBy = [listOptions.orderBy];
				findOptions.order = _.map(listOptions.orderBy, function (orderDef) {
					let matches = orderDef.match(/^([A-Za-z0-9_]+)(?:,(asc|desc))$/);
					if ( !matches) throw new HttpError(400, 'ERR_QUERY_ORDER_BY_INVALID');
					let fieldname = matches[1];
					let direction = matches[2];
					if ( !direction ) direction = 'asc';
					if ( !_.contains(fieldnames, fieldname)) throw new HttpError(400, 'ERR_QUERY_ORDER_BY_UNKNOWNFIELD');
					return [changecase.pascalCase(fieldname), direction];
				});
			}
			let result = await this.sequelize.model(model).findAll(findOptions);
			let list = _.map(result, (instance) => instance.get());
			refListOptions.offset = listOptions.offset;
			refListOptions.limit = listOptions.limit;
			refListOptions.orderBy = listOptions.orderBy;
			refListOptions.orderDirection = listOptions.orderDirection;
			return list;
		}.bind(this);
	}

	close() {
		if (!this.sequelize) return;
		this.sequelize.close();
		this.sequelize = null;
	}

}

module.exports = Schema;
