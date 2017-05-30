/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserRole', {
			UserUsername: {
				type: Sequelize.STRING,
				allowNull: false
			},
			RoleName: {
				type: Sequelize.STRING(25),
				allowNull: false
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
