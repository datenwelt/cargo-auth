const Sequelize = require('sequelize');
const VError = require('verror');

module.exports = {
	define: function (schema) {
		return schema.define('Permission', {
			Name: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
				comment: "Unique name of the permission."
			},
			Description: {
				type: Sequelize.TEXT,
				comment: "Textual description of the permission."
			}
		}, {
			classMethods: {
				applyPermissions: function (modifier, permissions) {
					permissions = permissions || [];
					const mode = modifier.get("Mode");
					const permission = modifier.get("PermissionName");
					switch (mode) {
						case 'allowed':
							if (!permissions.includes(permission))
								permissions.splice(permissions.length, 0, permission);
							break;
						case 'denied':
							if ( permissions.includes(permission) )
								permissions.splice(permissions.indexOf(permissions), 1);
							break;
						default:
							throw new VError('Unexpected value for role permission mode: %s', mode);
					}
					return permissions.sort();
				}
			}
		});
	}
};
