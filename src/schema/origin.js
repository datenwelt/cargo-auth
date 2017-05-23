const Sequelize = require('sequelize');

module.exports = {

	define: function(schema) {
		return schema.define('Origin', {
			Hostname: {
				type: Sequelize.STRING,
				primaryKey: true
			}
		});
	}
};
