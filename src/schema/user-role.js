const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserRole', {
			prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			tableName: 'user_roles'
		});
	}
};