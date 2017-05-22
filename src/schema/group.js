const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Group', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the group.'
			},
			Name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Human readable name of the group.'
			},
			OrganizationId: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			instanceMethods: {
				permissions: async function (permissions) {
					const groupId = this.get('Id');
					permissions = permissions || [];
					const groupRoles = await this.sequelize.model('GroupRole').findAll({
						where: {GroupId: groupId},
						order: [['Prio', 'ASC']]
					});
					for (let groupRole of groupRoles) {
						let roleId = groupRole.get('RoleId');
						// eslint-disable-next-line no-await-in-loop
						let role = await this.sequelize.model('Role').build({Id: roleId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await role.permissions(permissions);
					}
					const permissionModel = this.sequelize.model('Permission');
					const groupPermissions = await this.sequelize.model('GroupPermission').findAll({
						where: {GroupId: groupId}, order: [['Prio', 'ASC']]
					});
					for (let groupPermission of groupPermissions) {
						permissions = permissionModel.applyPermissions(groupPermission, permissions);
					}
					return permissions.sort();
				},
				roles: async function () {
					let groupRoles = await this.sequelize.model('GroupRole').findAll({
						where: {GroupId: this.get('Id')},
						order: [['Prio', 'ASC']]
					});
					let roles = [];
					for (let groupRole of groupRoles) {
						roles.push(groupRole.get('RoleId'));
					}
					return roles;
				}
			}
		});
	}
};