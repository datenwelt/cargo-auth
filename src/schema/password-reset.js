/* eslint-disable new-cap */
const crypto = require('crypto');
const moment = require('moment');
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('PasswordReset', {
			Token: {
				type: Sequelize.STRING(40),
				primaryKey: true
			},
			UserId: {
				type: Sequelize.INTEGER,
				allowNull: false
			},
			ExpiresAt: {
				type: Sequelize.DATE,
				allowNull: false
			},
		}, {
			classMethods: {
				createToken: function() {
					const hash = crypto.createHash('SHA1');
					hash.update(crypto.randomBytes(40));
					hash.update(String(moment().unix()));
					return hash.digest('hex');
				}
			}
		});
	}
};
