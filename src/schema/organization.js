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
			Hostname: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true
			},
			Address1: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Address2: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Address3: {
				type: Sequelize.STRING,
				allowNull: true
			},
			ZipCode: {
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(12),
				allowNull: true,
			},
			City: {
				type: Sequelize.STRING,
				allowNull: true
			},
			State: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Country: {
				type: Sequelize.STRING,
				allowNull: true
			},
			ContactName: {
				type: Sequelize.STRING,
				allowNull: true
			},
			ContactEmail: {
				type: Sequelize.STRING,
				allowNull: true
			},
			ContactPhone: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Extra: {
				type: Sequelize.TEXT,
				allowNull: true
			}
		});
	}
};