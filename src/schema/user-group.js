const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('UserGroup', {
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
