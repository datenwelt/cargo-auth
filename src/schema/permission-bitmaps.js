const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('PermissionBitmap', {
			Version: {
				field: 'version',
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(12),
				allowNull: false,
				primaryKey: true,
				comment: "Unique version string of the bitmap."
			},
			Permissions: {
				field: 'permissions',
				type: Sequelize.TEXT,
				comment: "A comma-seperated list of all known permission names."
			},
			CreatedAt: {
				type: Sequelize.DATE,
				comment: "Date and time when the bitmap has been introduced."
			}
		});
	}
};
