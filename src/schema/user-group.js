const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserGroup', {
			prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			tableName: 'user_groups'
		});
	}
};