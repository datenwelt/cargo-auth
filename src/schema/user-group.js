const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserGroup', {
			UserOriginId: {
				type: Sequelize.STRING
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
