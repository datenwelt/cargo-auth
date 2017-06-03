const Sequelize = require('sequelize');

const GroupModel = require('./group');
const RoleModel = require('./role');
const Checks = require('@datenwelt/cargo-api').Checks;

class GroupRoleModel {
	static define(schema) {
		return schema.define('GroupRole', {
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {

			classMethods: {
				checkGroupId: GroupRoleModel.checkGroupId,
				checkRoleName: GroupRoleModel.checkRoleName,
				checkPrio: GroupRoleModel.checkPrio
			}
		});
	}

	static checkGroupId(...args) {
		return GroupModel.checkId(...args);
	}

	static checkRoleName(...args) {
		return RoleModel.checkName(...args);
	}

	static checkPrio(value) {
		return Checks.type('number', value);
	}


}

module.exports = GroupRoleModel;
