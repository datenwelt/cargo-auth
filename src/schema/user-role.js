const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserRole', {
			UserOrganizationId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				unique: 'UserOrganizationId_RoleId_Unique'
			},
/*			RoleId: {
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(40),
				allowNull: false,
				unique: 'UserOrganizationId_RoleId_Unique'
			},*/
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
