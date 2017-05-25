const Sequelize = require('sequelize');
const NodeRSA = require('node-rsa');

module.exports = {
	define: function (schema) {
		return schema.define('System', {
			Name: {
				type: Sequelize.STRING,
				primaryKey: true,
			},
			RsaPublicKey: {
				type: Sequelize.TEXT,
				allowNull: false
			}
		}, {
			instanceMethods: {
				verifySignature: function (buffer, signature) {
					const rsaPublicKey = this.get('RsaPublicKey');
					const rsa = new NodeRSA(rsaPublicKey);
					return rsa.verify(buffer, signature, 'buffer', 'base64');
				}
			}
		});
	}
};
