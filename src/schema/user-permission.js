/* eslint-disable new-cap */
const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;
const UserModel = require('./user');
const PermissionModel = require('./permission');

class UserPermissionsModel {

	static define (schema) {
		return schema.define('UserPermission', {
			UserUsername: {
				type: Sequelize.STRING,
				primaryKey: true
			},
			PermissionName: {
				type: Sequelize.STRING,
				primaryKey: true
			},
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
				checkUserUsername: UserPermissionsModel.checkUserUsername,
				checkPermissionName: UserPermissionsModel.checkPermissionName,
				checkMode: UserPermissionsModel.checkMode,
				checkPrio: UserPermissionsModel.checkPrio,
			}
		});
	}

	static checkUserUsername(...args) {
		return UserModel.checkUsername(...args);
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

module.exports = UserPermissionsModel;
