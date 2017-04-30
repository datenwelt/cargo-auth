const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Settings', {
			Name: {
				field: 'name',
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
				comment: "Name of the configuration variable."
			},
			Value: {
				field: 'value',
				type: Sequelize.TEXT,
				comment: "Value of the configuration variable"
			},
			Description: {
				field: 'description',
				type: Sequelize.TEXT,
				comment: "Textual description of the configuration variable."
			}
		});
	}
};
