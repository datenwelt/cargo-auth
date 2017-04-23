const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('GroupPermission', {
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
			tableName: 'group_permissions'
		});
	}
};