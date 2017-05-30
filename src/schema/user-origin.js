/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserOrigin', {
			Id: {
				type: Sequelize.STRING,
				primaryKey: true
			},
			IsDefault: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
				allowNull: false
			}
		}, {
			instanceMethods: {
				permissions: async function (permissions) {
					const userGroups = await this.sequelize.model('UserGroup').findAll({
						where: { UserOriginId: this.get('Id')},
						order: [['Prio', 'ASC']]});
					for (let userGroup of userGroups) {
						let groupId = userGroup.get('GroupId');
						let group = this.sequelize.model('Group').build({Id: groupId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await group.permissions(permissions);
					}
					const userRoles = await this.sequelize.model('UserRole').findAll({
						where: {UserOriginId: this.get('Id')},
						order: [['Prio', 'ASC']]
					});
					for (let userRole of userRoles) {
						let roleName = userRole.get('RoleName');
						let role = this.sequelize.model('Role').build({Name: roleName});
						// eslint-disable-next-line no-await-in-loop
						permissions = await role.permissions(permissions);
					}
					const userPermissions = await this.sequelize.model('UserPermission').findAll({
						where: {UserOriginId: this.get('Id')}, order: [['Prio', 'ASC']]
					});
					const PermissionModel = await this.sequelize.model('Permission');
					for (let userPermission of userPermissions) {
						permissions = PermissionModel.applyPermissions(userPermission, permissions);
					}
					return permissions.sort();
				},
				roles: async function () {
					let roles = [];
					const userGroups = await this.getGroups();
					for (let userGroup of userGroups) {
						let groupId = userGroup.get('Id');
						let group = this.sequelize.model('Group').build({Id: groupId});
						// eslint-disable-next-line no-await-in-loop
						let groupRoles = await group.roles();
						roles = roles.concat(groupRoles);
					}
					const userRoles = await this.getRoles();
					for (let userRole of userRoles) {
						roles.push(userRole.get('Name'));
					}
					return roles;
				}
			}
		});
	}
};
