const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Permission', {
			Name: {
				field: 'name',
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
				comment: "Unique name of the permission."
			},
			Description: {
				field: 'description',
				type: Sequelize.TEXT,
				comment: "Textual description of the permission."
			}
		});
	}
};
