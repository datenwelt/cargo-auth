const Sequelize = require('sequelize');

const UserModel = require('./user');
const GroupModel = require('./group');
const Checks = require('@datenwelt/cargo-api').Checks;

class UserGroupModel {
	static define (schema) {
		return schema.define('UserGroup', {
			UserUsername: {
				type: Sequelize.STRING,
				allowNull: false
			},
			GroupId: {
				type: Sequelize.INTEGER,
				allowNull: false

			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			classMethods: {
				checkUserUsername: UserGroupModel.checkUserUsername,
				checkGroupId: UserGroupModel.checkGroupId,
				checkPrio: UserGroupModel.checkPrio
			}
		});
	}

	static checkUserUsername(value) {
		return UserModel.checkUsername(value);
	}

	static checkGroupId(value) {
		return GroupModel.checkId(value);
	}

	static checkPrio(value) {
		return Checks.type('number', value);
	}

}

module.exports = UserGroupModel;
