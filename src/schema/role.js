const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Role', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the role.'
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Human readable name of the role.'
			}
		});
	}
};