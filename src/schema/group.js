const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Group', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the group.'
			},
			Name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Human readable name of the group.'
			}
		});
	}
};