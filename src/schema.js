const process = require('process');
const Sequelize = require('sequelize');
const URI = require('urijs');

const Group = require('./schema/group');
const GroupPermission = require('./schema/group-permission');
const GroupRole = require('./schema/group-role');
const Organization = require('./schema/organization');
const Permission = require('./schema/permission');
const PermissionBitmap = require('./schema/permission-bitmaps');
const Role = require('./schema/role');
const RolePermission = require('./schema/role-permission');
const Setting = require('./schema/setting');
const User = require('./schema/user');
const UserGroup = require('./schema/user-group');
const UserRole = require('./schema/user-role');
const UserPermission = require('./schema/user-permission');

let schema = null;

class Schema {

	constructor(sequelize, uri) {
		this.sequelize = sequelize;
		this.uri = uri;
	}

	model(name) {
		return this.sequelize.model(name);
	}

	static async get(uri) {
		// eslint-disable-next-line no-process-env
		uri = uri || process.env.CARGO_AUTH_DB_URI;
		if (!schema) {
			schema = await Schema.init(uri);
		}
		return schema;
	}

	static close() {
		if (schema && schema.sequelize) {
			schema.sequelize.close();
			schema = null;
		}
	}

	static async init(...args) {
		if (schema && schema.sequelize) {
			schema.sequelize.close();
		}

		let uri = null;
		let options = {};
		switch (args.length) {
			case 0:
				break;
			case 1:
				if ( typeof args[0] === 'string' || args[0] instanceof URI ) {
					uri = args[0];
				} else {
					options = args[0];
				}
				break;
			default:
				uri = args[0];
				options = args[1];
		}

		// eslint-disable-next-line no-process-env
		uri = uri || process.env.CARGO_AUTH_DB_URI;
		if ( uri instanceof URI ) {
			uri = uri.toString();
		}

		const config = Object.assign({
			drop: false,
			sync: false
		}, options || {});

		const sequelize = new Sequelize(uri, {
			define: {
				timestamps: false
			},
			timezone: 'Europe/Berlin',
			logging: false,
			pool: true
		});

		const Organizations = Organization.define(sequelize);
		const Roles = Role.define(sequelize);
		const Groups = Group.define(sequelize);
		const Permissions = Permission.define(sequelize);
		// eslint-disable-next-line no-unused-vars
		const PermissionBitmaps = PermissionBitmap.define(sequelize);
		const GroupPermissions = GroupPermission.define(sequelize);
		const GroupRoles = GroupRole.define(sequelize);
		const RolePermissions = RolePermission.define(sequelize);
		const Users = User.define(sequelize);
		const UserGroups = UserGroup.define(sequelize);
		const UserRoles = UserRole.define(sequelize);
		const UserPermissions = UserPermission.define(sequelize);
		// eslint-disable-next-line no-unused-vars
		const Settings = Setting.define(sequelize);

		Organizations.hasMany(Users);
		Organizations.hasMany(Groups);
		Organizations.hasMany(Roles);

		Roles.belongsTo(Organizations);
		Roles.belongsToMany(Permissions, {through: RolePermissions});

		Groups.belongsTo(Organizations);
		Groups.belongsToMany(Permissions, {through: GroupPermissions});
		Groups.belongsToMany(Roles, {through: GroupRoles});
		Groups.belongsToMany(Users, {through: UserGroups});

		Users.belongsTo(Organizations);
		Users.belongsToMany(Groups, {through: UserGroups});
		Users.belongsToMany(Roles, {through: UserRoles});
		Users.belongsToMany(Permissions, {through: UserPermissions});

		if (config.drop) {
			await sequelize.dropAllSchemas();
		}

		await sequelize.sync({force: config.force});

		await Organizations.findOrCreate({
			where: {Name: 'PUBLIC'},
			defaults: {Name: 'PUBLIC'}
		});
		schema = new Schema(sequelize, uri);
		return schema;
	}

}

module.exports = Schema;
