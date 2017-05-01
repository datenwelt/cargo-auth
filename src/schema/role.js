const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Role', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the role.'
			},
			Name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Human readable name of the role.'
			}
		}, {
			instanceMethods: {
				permissions: async function(permissions) {
					const roleId = this.get('Id');
					permissions = permissions || [];
					const rolePermissions = await this.sequelize.model('RolePermission').findAll({
						where: {roleId: roleId}, order: [['Prio', 'ASC']]
					});
					let permissionModel = this.sequelize.model('Permission');
					for ( let rolePermission of rolePermissions) {
						permissions = permissionModel.applyPermissions(rolePermission, permissions);
					}
					return permissions.sort();

				}
			}
		});
	}
};