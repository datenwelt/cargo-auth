const Sequelize = require('sequelize');
const VError = require('verror');

const Group = require('./schema/group');
const GroupPermission = require('./schema/group-permission');
const GroupRole = require('./schema/group-role');
const Organization = require('./schema/organization');
const PasswordReset = require('./schema/password-reset');
const Permission = require('./schema/permission');
const PermissionBitmap = require('./schema/permission-bitmap');
const Role = require('./schema/role');
const RolePermission = require('./schema/role-permission');
const Session = require('./schema/session');
const User = require('./schema/user');
const UserActivation = require('./schema/user-activation');
const UserGroup = require('./schema/user-group');
const UserRole = require('./schema/user-role');
const UserOrganization = require('./schema/user-organization');
const UserPermission = require('./schema/user-permission');

class Schema {

	constructor() {
		this.sequelize = null;
	}

	async init(config, options) {
		if ( this.sequelize ) return this.sequelize;
		options = Object.assign({
			drop: false,
			sync: false
		}, options || {});

		config.database = config.database || 'cargo_auth';
		config.username = config.username ||'cargo';

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
		const Organizations = Organization.define(sequelize);
		const Roles = Role.define(sequelize);
		const Groups = Group.define(sequelize);
		const PasswordResets = PasswordReset.define(sequelize);
		const Permissions = Permission.define(sequelize);
		// eslint-disable-next-line no-unused-vars
		const PermissionBitmaps = PermissionBitmap.define(sequelize);
		const GroupPermissions = GroupPermission.define(sequelize);
		const GroupRoles = GroupRole.define(sequelize);
		const RolePermissions = RolePermission.define(sequelize);
		const Users = User.define(sequelize);
		// eslint-disable-next-line no-unused-vars
		const UserActivations = UserActivation.define(sequelize);
		const UserGroups = UserGroup.define(sequelize);
		const UserRoles = UserRole.define(sequelize);
		const UserPermissions = UserPermission.define(sequelize);
		const UserOrganizations = UserOrganization.define(sequelize);
		// eslint-disable-next-line no-unused-vars
		const Sessions = Session.define(sequelize);

		Organizations.hasMany(Groups);
		Organizations.hasMany(Roles);

		Roles.belongsTo(Organizations);
		Roles.belongsToMany(Permissions, {through: RolePermissions});

		Groups.belongsTo(Organizations);
		Groups.belongsToMany(Permissions, {through: GroupPermissions});
		Groups.belongsToMany(Roles, {through: GroupRoles});
		Groups.belongsToMany(Users, {through: UserGroups});

		Users.hasMany(PasswordResets);
		Users.belongsToMany(Organizations, {through: UserOrganizations});
		Users.belongsToMany(Groups, {through: UserGroups});
		Users.belongsToMany(Roles, {through: UserRoles});
		Users.belongsToMany(Permissions, {through: UserPermissions});
	}

	async defineData() {
		const Organizations = this.sequelize.model('Organization');
		await Organizations.findOrCreate({
			where: {Name: 'PUBLIC'},
			defaults: {Name: 'PUBLIC'}
		});
	}

	get() {
		return this.sequelize;
	}

	close() {
		if ( !this.sequelize) return;
		this.sequelize.close();
		this.sequelize = null;
	}

}

module.exports = Schema;
