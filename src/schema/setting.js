const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Settings', {
			name: {
				field: 'name',
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
				comment: "Name of the configuration variable."
			},
			value: {
				field: 'value',
				type: Sequelize.TEXT,
				comment: "Value of the configuration variable"
			},
			description: {
				field: 'description',
				type: Sequelize.TEXT,
				comment: "Textual description of the configuration variable."
			}
		});
	}
};
