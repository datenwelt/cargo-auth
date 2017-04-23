const Sequelize = require('sequelize');

module.exports = {

	define: function(schema) {
		return schema.define('Organization', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the organization.'
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Name of the organization.'
			}
		});
	}
};