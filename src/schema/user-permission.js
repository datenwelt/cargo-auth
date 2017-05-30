/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserPermission', {
			UserUsername: {
				type: Sequelize.STRING,
				primaryKey: true
			},
			PermissionName: {
				type: Sequelize.STRING,
				primaryKey: true
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
