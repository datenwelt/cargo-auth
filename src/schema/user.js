const crypto = require('crypto');
const Promise = require('bluebird');
const Sequelize = require('sequelize');
const VError = require('verror');

const Checks = require('@datenwelt/cargo-api').Checks;

class UserModel {

	static define(schema) {
		return schema.define('User', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			Username: {
				type: Sequelize.STRING,
				unique: true,
				allowNull: false
			},
			Password: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Hash of the login password of the user preprended by {MD5|SHA1|SHA256}.'
			},
			Email: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Email address of the user for password recovery.'
			},
			Active: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
				comment: 'True if user can login, false if user login is temporarily deactivated.'
			}
		}, {
			classMethods: {
				createPassword: function (plaintext) {
					const algo = 'SHA1';
					let password = "{" + algo + "}";
					password += crypto.createHash(algo).update(plaintext).digest('hex');
					return password;
				}
			},
			instanceMethods: {
				permissions: async function () {
					const userId = this.get('Id');
					let userGroups = await this.sequelize.model('UserGroup').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					let groups = await Promise.map(userGroups, async function (userGroup) {
						let groupId = userGroup.get('GroupId');
						let group = await this.sequelize.model('Group').findById(groupId);
						return group;
					}.bind(this));
					let permissions = await Promise.reduce(groups, function (memo, group) {
						return group.permissions(memo);
					}, []);
					let userRoles = await this.sequelize.model('UserRole').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					let roles = await Promise.map(userRoles, function (userRole) {
						let roleId = userRole.get('RoleName');
						return this.sequelize.model('Role').findById(roleId);
					}.bind(this));
					permissions = await Promise.reduce(roles, function (memo, role) {
						return role.permissions(memo);
					}, permissions);
					const permissionModel = this.sequelize.model('Permission');
					let userPermissions = await this.sequelize.model('UserPermission').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					permissions = await Promise.reduce(userPermissions, function (memo, modifier) {
						return permissionModel.applyPermissions(modifier, memo);
					}, permissions);
					return permissions;
				},
				roles: async function () {
					const userId = this.get('Id');
					let groups = await Promise.map(this.sequelize.model('UserGroup').findAll({
						where: {'UserId': userId}, order: [['Prio', 'ASC']]
					}), function (userGroup) {
						return this.sequelize.model('Group').findById(userGroup.get('GroupId'));
					}.bind(this));
					let roles = await Promise.reduce(groups, async function (memo, group) {
						return memo.concat(await group.roles());
					}, []);

					let p = this.sequelize.model('UserRole').findAll({
						where: {'UserId': userId}, order: [['Prio', 'ASC']]
					});
					let userRoles = await Promise.map(p, (userRole) => userRole.get('RoleName'));
					roles = roles.concat(userRoles);
					return roles;
				}
			}
		});
	}

	static checkUsername(value) {
		value = Checks.type('string', value).trim();
		value = Checks.notBlank(value);
		value = Checks.minLength(3, value);
		value = Checks.maxLength(255, value);
		return value;
	}

	static checkPassword(value, blacklist) {
		blacklist = blacklist || [];

		function complexity(value) {
			let score = 0;
			if (value.match(/[a-z]/)) score++;
			if (value.match(/[A-Z]/)) score++;
			if (value.match(/[0-9]/)) score++;
			if (value.match(/[^0-9a-zA-Z]/)) score++;
			if (score < 3) throw new VError({name: 'Complexity'});
			return value;
		}

		function forbidden(value) {
			if (blacklist.includes(value)) throw new VError({name: 'Forbidden'});
			return value;
		}

		value = Checks.type('string', value);
		value = Checks.notBlank(value);
		value = Checks.minLength(6, value);
		value = Checks.maxLength(40, value);
		try {
			complexity(value);
		} catch (err) {
			if (err.name === 'Complexity')    throw new VError({name: 'CargoCheckError'}, 'TOOWEAK');
			throw new VError(err);
		}
		try {
			forbidden(value);
		} catch (err) {
			if (err.name === 'Forbidden') throw new VError({name: 'CargoCheckError'}, 'FORBIDDEN');
			throw new VError(err);
		}
		return value;
	}

	static checkEmail(value) {
		value = Checks.type('string', value).trim();
		value = Checks.notBlank(value);
		value = Checks.minLength(3, value);
		value = Checks.maxLength(255, value);
		return value;
	}

}

module.exports = UserModel;

