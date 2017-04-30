const Sequelize = require('sequelize');

module.exports = {

	define: function(schema) {
		return schema.define('Organization', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the organization.'
			},
			Name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Name of the organization.'
			},
			ShortName: {
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(40)
			}
		});
	}
};