const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserGroup', {
			UserUsername: {
				type: Sequelize.STRING,
				allowNull: false
			},
			GroupId: {
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
