const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserRole', {
			UserOriginId: {
				type: Sequelize.STRING,
				allowNull: false
			},
			RoleId: {
				type: Sequelize.INTEGER,
				allowNull: false
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
