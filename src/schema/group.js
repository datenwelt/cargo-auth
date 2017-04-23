const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Group', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the group.'
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Human readable name of the group.'
			}
		});
	}
};