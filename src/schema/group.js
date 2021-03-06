const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;

class Group {

	static define(schema) {
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
			}
		}, {
			classMethods: {
				checkId: Group.checkId,
				checkName: Group.checkName
			},
			instanceMethods: {
				permissions: async function (permissions) {
					const groupId = this.get('Id');
					permissions = permissions || [];
					const groupRoles = await this.sequelize.model('GroupRole').findAll({
						where: {GroupId: groupId},
						order: [['Prio', 'ASC']]
					});
					for (let groupRole of groupRoles) {
						let roleName = groupRole.get('RoleName');
						// eslint-disable-next-line no-await-in-loop
						let role = await this.sequelize.model('Role').build({Name: roleName});
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
						roles.push(groupRole.get('RoleName'));
					}
					return roles;
				}
			}
		});
	}

	static checkId(value) {
		value = Checks.cast('number', value);
		return Checks.min(1, value);
	}

	static checkName(value) {
		value = Checks.cast('string', value);
		return Checks.maxLength(255, value);
	}

}

module.exports = Group;

