/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserPermission', {
			UserId: {
				type: Sequelize.INTEGER
			},
			PermissionName: {
				type: Sequelize.STRING
			},
			Mode: {
				type: Sequelize.ENUM('allowed', 'denied'),
				allowNull: false,
				defaultValue: 'allowed'
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
