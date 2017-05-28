/* eslint-disable new-cap */
const crypto = require('crypto');
const moment = require('moment');
const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;

class UserActivationModel {
	static define(schema) {
		return schema.define('UserActivation', {
			Id: {
				type: Sequelize.STRING(40),
				primaryKey: true
			},
			Username: {
				type: Sequelize.STRING,
				allowNull: false
			},
			Password: {
				type: Sequelize.STRING,
				allowNull: true
			},
			Email: {
				type: Sequelize.STRING,
				allowNull: true
			},
			ExpiresAt: {
				type: Sequelize.DATE,
				allowNull: false
			},
			Extra: {
				type: Sequelize.TEXT,
				allowNull: true
			},
		}, {
			classMethods: {
				createId: function() {
					const hash = crypto.createHash('SHA1');
					hash.update(crypto.randomBytes(40));
					hash.update(String(moment().unix()));
					return hash.digest('hex');
				}
			}
		});
	}

	static checkToken(value){
		value = Checks.type('string', value).trim();
		value = Checks.notBlank(value);
		value = Checks.minLength(40, value);
		value = Checks.maxLength(40, value);
		return value;
	}

}

module.exports = UserActivationModel;

