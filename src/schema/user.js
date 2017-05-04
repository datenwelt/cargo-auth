const Sequelize = require('sequelize');

module.exports = {

	define: function (schema) {
		return schema.define('User', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the user.'
			},
			Username: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
				comment: 'Login username of the user.'
			},
			Password: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Hash of the login password of the user preprended by {MD5|SHA1|SHA256}.'
			},
			Email: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Email address of the user for password recovery.'
			},
			Active: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
				comment: 'True if user can login, false if user login is temporarily deactivated.'
			},
			RsaPublicKey: {
				type: Sequelize.TEXT,
				allowNull: true,
				comment: 'RSA public key of the user. (optional)'
			}
		}, {
			instanceMethods: {
				permissions: async function (permissions) {
					permissions = permissions || [];
					const userId = this.get('Id');
					const userGroups = await this.sequelize.model('UserGroup').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					for (let userGroup of userGroups) {
						let groupId = userGroup.get('GroupId');
						let group = this.sequelize.model('Group').build({Id: groupId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await group.permissions(permissions);
					}
					const userRoles = await this.sequelize.model('UserRole').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					for (let userRole of userRoles) {
						let roleId = userRole.get('RoleId');
						let role = this.sequelize.model('Role').build({Id: roleId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await role.permissions(permissions);
					}
					const userPermissions = await this.sequelize.model('UserPermission').findAll({
						where: {UserId: userId}, order: [['Prio', 'ASC']]
					});
					const PermissionModel = await this.sequelize.model('Permission');
					for (let userPermission of userPermissions) {
						permissions = PermissionModel.applyPermissions(userPermission, permissions);
					}
					return permissions.sort();
				}
			}
		});
	}
};
