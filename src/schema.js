const Sequelize = require('sequelize');

const Group = require('./schema/group');
const GroupPermission = require('./schema/group-permission');
const GroupRole = require('./schema/group-role');
const Organization = require('./schema/organization');
const Permission = require('./schema/permission');
const Role = require('./schema/role');
const RolePermission = require('./schema/role-permission');
const User = require('./schema/user');
const UserGroup = require('./schema/user-group');
const UserRole = require('./schema/user-role');
const UserPermission = require('./schema/user-permission');

module.exports = {

	init: async function (uri, options) {
		const schema = new Sequelize(uri, {
			define: {
				timestamps: false,
				underscored: true,
				underscoredAll: true,
			},
			timezone: 'Europe/Berlin'
		});

		const Organizations = Organization.define(schema);
		const Roles = Role.define(schema);
		const Groups = Group.define(schema);
		const Permissions = Permission.define(schema);
		const GroupPermissions = GroupPermission.define(schema);
		const GroupRoles = GroupRole.define(schema);
		const RolePermissions = RolePermission.define(schema);
		const Users = User.define(schema);
		const UserGroups = UserGroup.define(schema);
		const UserRoles = UserRole.define(schema);
		const UserPermissions = UserPermission.define(schema);

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

		if ( options.drop ) {
			await schema.drop();
		}

		await schema.sync( { force: options.force });

		await Organizations.findOrCreate({
			where: {name: 'PUBLIC'},
			defaults: {name:'PUBLIC'}
		});

		return schema;
	}

};
