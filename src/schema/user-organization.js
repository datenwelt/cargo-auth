/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserOrganization', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			UserId: {
				type: Sequelize.INTEGER,
				unique: 'Unique_UserIdOrganizationId'
			},
			OrganizationId: {
				type: Sequelize.INTEGER,
				unique: 'Unique_UserIdOrganizationId'
			}
		}, {
			instanceMethods: {
				permissions: async function (permissions) {
					const userGroups = await this.getGroups();
					for (let userGroup of userGroups) {
						let groupId = userGroup.get('GroupId');
						let group = this.sequelize.model('Group').build({Id: groupId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await group.permissions(permissions);
					}
					const userRoles = await this.sequelize.model('UserRole').findAll({
						where: {UserOrganizationId: this.get('Id')},
						order: [['Prio', 'ASC']]
					});
					for (let userRole of userRoles) {
						let roleId = userRole.get('RoleId');
						let role = this.sequelize.model('Role').build({Id: roleId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await role.permissions(permissions);
					}
					const userPermissions = await this.sequelize.model('UserPermission').findAll({
						where: {UserOrganizationId: this.get('Id')}, order: [['Prio', 'ASC']]
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
						roles.push(userRole.get('Id'));
					}
					return roles;
				}
			}
		});
	}
};
