/* eslint-disable new-cap */
const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;

const RoleModel = require('./role');
const UserModel = require('./user');

class UserRolesModel {

	static define (schema) {
		return schema.define('UserRole', {
			UserUsername: {
				type: Sequelize.STRING,
				allowNull: false
			},
			RoleName: {
				type: Sequelize.STRING(25),
				allowNull: false
			},
			Prio: {
				type: Sequelize.INTEGER,
				allowNull: false
			}
		}, {
			classMethods: {
				checkUserUsername: UserRolesModel.checkUserUsername,
				checkRoleName: UserRolesModel.checkRoleName,
				checkPrio: UserRolesModel.checkPrio
			}
		});
	}

	static checkUserUsername(...args) {
		return UserModel.checkUsername(...args);
	}

	static checkRoleName(...args) {
		return RoleModel.checkName(...args);
	}

	static checkPrio(value) {
		return Checks.type('number', value);
	}

}

module.exports = UserRolesModel;
