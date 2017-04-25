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

let schema = null;

function Schema(sequelize, uri) {
	this.sequelize = sequelize;
	this.uri = uri;
}

Schema.prototype.constructor = Schema;

Schema.prototype.model = function(name) {
	return this.sequelize.model(name);
};


module.exports = {

	get: function() {
		if (!schema)
			throw new Error('Schema is not initialized yet. Call schema.init() before use.');
		return schema;
	},

	init: async function(uri, options) {
		if (schema) return schema;
		const config = Object.assign({
			drop: false,
			sync: false
		}, options || {});

		const sequelize = new Sequelize(uri, {
			define: {
				timestamps: false,
				underscored: true,
				underscoredAll: true,
			},
			timezone: 'Europe/Berlin',
			logging: false
		});

		const Organizations = Organization.define(sequelize);
		const Roles = Role.define(sequelize);
		const Groups = Group.define(sequelize);
		const Permissions = Permission.define(sequelize);
		const GroupPermissions = GroupPermission.define(sequelize);
		const GroupRoles = GroupRole.define(sequelize);
		const RolePermissions = RolePermission.define(sequelize);
		const Users = User.define(sequelize);
		const UserGroups = UserGroup.define(sequelize);
		const UserRoles = UserRole.define(sequelize);
		const UserPermissions = UserPermission.define(sequelize);

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
			await sequelize.drop();
		}

		await sequelize.sync({force: config.force});

		await Organizations.findOrCreate({
			where: {name: 'PUBLIC'},
			defaults: {name: 'PUBLIC'}
		});
		schema = new Schema(sequelize, uri);
		return schema;
	}

};
