const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserGroup', {
			UserId: {
				type: Sequelize.INTEGER
			},
			GroupId: {
				type: Sequelize.INTEGER
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
