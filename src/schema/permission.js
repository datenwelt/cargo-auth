const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Permission', {
			name: {
				field: 'perm_name',
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
				comment: "Unique name of the permission."
			},
			description: {
				field: 'perm_description',
				type: Sequelize.TEXT,
				comment: "Textual description of the permission."
			}
		});
	}
};
