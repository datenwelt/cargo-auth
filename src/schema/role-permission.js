/* eslint-disable new-cap */
const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;
const RoleModel = require('./role');
const PermissionModel = require('./permission');

class RolePermissionsModel {
	static define(schema) {
		return schema.define('RolePermission', {
			Mode: {
				type: Sequelize.ENUM('allowed', 'denied'),
				allowNull: false,
				defaultValue: 'allowed'
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			classMethods: {
				checkRoleName: RolePermissionsModel.checkRoleName,
				checkPermissionName: RolePermissionsModel.checkPermissionName,
				checkMode: RolePermissionsModel.checkMode,
				checkPrio: RolePermissionsModel.checkPrio,
			}
		});
	}

	static checkRoleName(...args) {
		return RoleModel.checkName(...args);
	}

	static checkPermissionName(...args) {
		return PermissionModel.checkName(...args);
	}

	static checkMode(value) {
		value = Checks.cast('string', value);
		return Checks.match(/^(allowed|denied)$/, value);
	}

	static checkPrio(value) {
		return Checks.type('integer', value);
	}
}

module.exports = RolePermissionsModel;

