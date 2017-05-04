const Sequelize = require('sequelize');
const URI = require('urijs');

const Group = require('./schema/group');
const GroupPermission = require('./schema/group-permission');
const GroupRole = require('./schema/group-role');
const Organization = require('./schema/organization');
const Permission = require('./schema/permission');
const PermissionBitmap = require('./schema/permission-bitmap');
const Role = require('./schema/role');
const RolePermission = require('./schema/role-permission');
const Session = require('./schema/session');
const User = require('./schema/user');
const UserGroup = require('./schema/user-group');
const UserRole = require('./schema/user-role');
const UserOrganization = require('./schema/user-organisation');
const UserPermission = require('./schema/user-permission');

class Schema {

	static async init(uri, options) {
		// eslint-disable-next-line no-process-env
		if (uri instanceof URI) {
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

		Users.belongsToMany(Organizations, {through: UserOrganizations});
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
		return sequelize;
	}

}

module.exports = Schema;
