const crypto = require('crypto');
const Sequelize = require('sequelize');

const check = require('@datenwelt/cargo-api').Check;

module.exports = {

	define: function (schema) {
		return schema.define('User', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the user.'
			},
			Username: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
				comment: 'Login username of the user.'
			},
			Password: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Hash of the login password of the user preprended by {MD5|SHA1|SHA256}.'
			},
			Email: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'Email address of the user for password recovery.'
			},
			Active: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
				comment: 'True if user can login, false if user login is temporarily deactivated.'
			},
			RsaPublicKey: {
				type: Sequelize.TEXT,
				allowNull: true,
				comment: 'RSA public key of the user. (optional)'
			},
			Firstname: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Lastname: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Extra: {
				type: Sequelize.TEXT,
				allowNull: true
			}
		}, {
			classMethods: {
				checkPassword: function (password, blacklist) {
					blacklist = blacklist || [];

					function complexity(value) {
						let score = 0;
						if (value.match(/[a-z]/)) score++;
						if (value.match(/[A-Z]/)) score++;
						if (value.match(/[0-9]/)) score++;
						if (value.match(/[^0-9a-zA-Z]/)) score++;
						if (score < 3) throw new Error();
						return value;
					}

					function forbidden(value) {
						if (blacklist.includes(value)) throw new Error();
						return value;
					}

					password = check(password).trim('ERR_PASSWORD_INVALID')
						.not().isBlank('ERR_PASSWORD_MISSING')
						.minLength(6, 'ERR_PASSWORD_TOO_SHORT')
						.maxLength(64, 'ERR_PASSWORD_TOO_LONG')
						.transform(complexity, 'ERR_PASSWORD_TOO_WEAK')
						.transform(forbidden, 'ERR_PASSWORD_INVALID')
						.val();
					return password;
				},
				createPassword: function (plaintext) {
					const algo = 'SHA1';
					let password = "{" + algo + "}";
					password += crypto.createHash(algo).update(plaintext).digest('hex');
					return password;
				}
			},
			instanceMethods: {
				permissions: async function (permissions) {
					permissions = permissions || [];
					const userId = this.get('Id');
					const userGroups = await this.sequelize.model('UserGroup').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					for (let userGroup of userGroups) {
						let groupId = userGroup.get('GroupId');
						let group = this.sequelize.model('Group').build({Id: groupId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await group.permissions(permissions);
					}
					const userRoles = await this.sequelize.model('UserRole').findAll({
						where: {UserId: userId},
						order: [['Prio', 'ASC']]
					});
					for (let userRole of userRoles) {
						let roleId = userRole.get('RoleId');
						let role = this.sequelize.model('Role').build({Id: roleId});
						// eslint-disable-next-line no-await-in-loop
						permissions = await role.permissions(permissions);
					}
					const userPermissions = await this.sequelize.model('UserPermission').findAll({
						where: {UserId: userId}, order: [['Prio', 'ASC']]
					});
					const PermissionModel = await this.sequelize.model('Permission');
					for (let userPermission of userPermissions) {
						permissions = PermissionModel.applyPermissions(userPermission, permissions);
					}
					return permissions.sort();
				}
			}
		});
	}
};
