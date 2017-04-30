const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserRole', {
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
