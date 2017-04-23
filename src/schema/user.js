const Sequelize = require('sequelize');

module.exports = {

	define: function(schema) {
		return schema.define('User', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				comment: 'Unique numerical ID of the user.'
			},
			username: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
				comment: 'Login username of the user.'
			},
			password: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Hash of the login password of the user preprended by {MD5|SHA1|SHA256}.'
			},
			email: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Email address of the user for password recovery.'
			}
		});
	}
};