const crypto = require('crypto');
const Sequelize = require('sequelize');

const check = require('@datenwelt/cargo-api').Check;

module.exports = {

	define: function (schema) {
		return schema.define('User', {
			Id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			Username: {
				type: Sequelize.STRING,
				unique: true
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
				permissions: async function () {
					const userId = this.get('Id');
					const userOrigins = await this.sequelize.model('UserOrigin').findAll({
						where: {UserId: userId}
					});
					let permissions = {};
					for (let userOrigin of userOrigins) {
						let hostname = userOrigin.get('OriginHostname');
						// eslint-disable-next-line no-await-in-loop
						permissions[hostname] = await userOrigin.permissions([]);
					}
					return permissions;
				},
				roles: async function () {
					const userId = this.get('Id');
					const userOrigins = await this.sequelize.model('UserOrigin').findAll({
						where: {UserId: userId}
					});
					let roles = {};
					for (let userOrigin of userOrigins) {
						let hostname = userOrigin.get('OriginHostname');
						let userRoles = await userOrigin.roles();
						roles[hostname] = userRoles;
					}
					return roles;
				}
			}
		});
	}
};
