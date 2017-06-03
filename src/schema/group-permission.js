/* eslint-disable new-cap */
const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;
const GroupModel = require('./group');
const PermissionModel = require('./permission');

class GroupPermissionsModel {
	static define (schema) {
		return schema.define('GroupPermission', {
			Mode: {
				type: Sequelize.ENUM('allowed', 'denied'),
				allowNull: false,
				defaultValue: 'allowed'
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		},{
			classMethods: {
				checkGroupId: GroupPermissionsModel.checkGroupId,
				checkPermissionName: GroupPermissionsModel.checkPermissionName,
				checkMode: GroupPermissionsModel.checkMode,
				checkPrio: GroupPermissionsModel.checkPrio
			}
		});
	}

	static checkGroupId(...args) {
		return GroupModel.checkId(...args);
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

module.exports = GroupPermissionsModel;
