/* eslint-disable new-cap */
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserOrganization', {
			UserId: {
				type: Sequelize.INTEGER
			},
			OrganizationId: {
				type: Sequelize.INTEGER
			}
		});
	}
};