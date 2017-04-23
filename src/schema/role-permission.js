const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('RolePermission', {
			mode: {
				type: Sequelize.ENUM('allowed', 'denied'),
				allowNull: false,
				defaultValue: 'allowed'
			},
			prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			tableName: 'role_permissions'
		});
	}
};