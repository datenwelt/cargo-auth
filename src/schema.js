/* eslint-disable global-require */
const Sequelize = require('sequelize');


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
		model('UserOrigin').belongsToMany(model('Permission'), {through: model('UserPermission'), foreignKey: 'UserOriginId'});
	}

	defineData() {
	}

	get() {
		return this.sequelize;
	}

	close() {
		if (!this.sequelize) return;
		this.sequelize.close();
		this.sequelize = null;
	}

}

module.exports = Schema;
