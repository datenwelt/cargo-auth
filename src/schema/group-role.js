const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('GroupRole', {
			prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			tableName: 'group_roles'
		});
	}
};