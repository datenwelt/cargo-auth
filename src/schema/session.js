/* eslint-disable new-cap */
const bluebird = require('bluebird');
const crypto = require('crypto');
const jwt = bluebird.promisifyAll(require('jsonwebtoken'));
const moment = require('moment');
const ms = require('ms');

const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('Session', {
			Id: {
				type: Sequelize.STRING(40),
				primaryKey: true
			},
			Username: {
				type: Sequelize.STRING,
				allowNull: false
			},
			IssuedAt: {
				type: Sequelize.DATE,
				allowNull: false
			},
			ExpiresAt: {
				type: Sequelize.DATE,
				allowNull: false
			},
			Secret: {
				type: Sequelize.STRING(32),
				allowNull: false
			}
		}, {
			classMethods: {
				createForUser: async function (user, rsaPrivateKey, options) {
					options = Object.assign({validFor: '4h'}, options || {});

					// Create a session id.
					let hash = crypto.createHash('SHA1');
					hash.update(new Date().getTime().toString());
					hash.update(crypto.randomBytes(16));
					const sessionId = hash.digest('hex');

					// Create a secret for use with HMAC signing.
					hash = crypto.createHash('SHA1');
					hash.update(sessionId);
					hash.update(crypto.randomBytes(16));
					const secret = hash.digest('base64');

					const permissions = await user.permissions();
					let latestPBM = await schema.model('PermissionBitmap').findLatest();
					if (!latestPBM) {
						latestPBM = await schema.model('PermissionBitmap').createLatest();
					}
					let pbm = latestPBM.permissionsToBitmap(permissions);
					const iat = moment();
					const exp = iat.add(ms(options.validFor), 'ms');
					let session = {
						id: sessionId,
						expiresIn: options.validFor,
						issuedAt: iat.unix(),
						username: user.get('Username'),
						permissions: permissions,
						secret: secret
					};
					session.token = await jwt.signAsync({
						sess: sessionId,
						iat: iat.unix(),
						exp: exp.unix(),
						usr: user.get('Username'),
						pbm: {vers: latestPBM.Version, bits: pbm}
					}, rsaPrivateKey, {algorithm: 'RS256'});
					this.create({
						Id: sessionId,
						Username: user.get('Username'),
						IssuedAt: iat.toDate(),
						ExpiresAt: exp.toDate(),
						Secret: secret
					});
					return session;
				}
			}
		});
	}
};
