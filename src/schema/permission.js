const Sequelize = require('sequelize');
const VError = require('verror');

const Checks = require('@datenwelt/cargo-api').Checks;

class Permission {
	static define(schema) {
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
				checkName: Permission.checkName,
				checkDescription: Permission.checkDescription,
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
							if (permissions.includes(permission))
								permissions.splice(permissions.indexOf(permissions), 1);
							break;
						default:
							throw new VError('Unexpected value for role permission mode: %s', mode);
					}
					return permissions.sort();
				}
			},
			hooks: {
				afterUpdate: async function() {
					await this.sequelize.model('PermissionBitmap').createLatest();
				},
				afterDestroy: async function() {
					await this.sequelize.model('PermissionBitmap').createLatest();
				},
				afterCreate: async function() {
					await this.sequelize.model('PermissionBitmap').createLatest();
				},
				afterSave: async function() {
					await this.sequelize.model('PermissionBitmap').createLatest();
				},
				afterUpsert: async function() {
					await this.sequelize.model('PermissionBitmap').createLatest();
				}
			}

		});
	}

	static checkName(value) {
		value = Checks.type('string', value).trim();
		value = Checks.notBlank(value);
		value = Checks.minLength(3, value);
		value = Checks.maxLength(255, value);

		value = Checks.match(/^[a-zA-Z0-9_.\-]+$/, value);
		return value;
	}

	static checkDescription(value) {
		value = Checks.type('string', value).trim();
		return value;
	}

}

module.exports = Permission;
