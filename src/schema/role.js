const Sequelize = require('sequelize');

const Checks = require('@datenwelt/cargo-api').Checks;

class Role {

	static define(schema) {
		return schema.define('Role', {
			Name: {
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(25),
				primaryKey: true
			},
			Description: {
				type: Sequelize.STRING,
				allowNull: true
			}
		}, {
			instanceMethods: {
				permissions: async function(permissions) {
					const roleName = this.get('Name');
					permissions = permissions || [];
					const rolePermissions = await this.sequelize.model('RolePermission').findAll({
						where: {roleName: roleName}, order: [['Prio', 'ASC']]
					});
					let permissionModel = this.sequelize.model('Permission');
					for ( let rolePermission of rolePermissions) {
						permissions = permissionModel.applyPermissions(rolePermission, permissions);
					}
					return permissions.sort();

				}
			}
		});
	}

	static checkName(value) {
		value = Checks.type('string', value).trim();
		value = Checks.notBlank(value);
		value = Checks.minLength(3, value);
		value = Checks.maxLength(25, value);
		value = Checks.match(/^[a-zA-Z0-9_.\-]+$/, value);
		return value;
	}

	static checkDescription(value) {
		value = Checks.type('string', value).trim();
		return value;
	}

}

module.exports = Role;
