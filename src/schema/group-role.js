const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('GroupRole', {
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		});
	}
};
