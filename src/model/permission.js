const _ = require('underscore');
const crypto = require('crypto');
const VError = require('verror');

const Model = require('../model');
const Schema = require('../schema');

let instance = null;

class Permission extends Model {

	constructor(schema) {
		super('io.cargohub.permission');
		this.schema = schema;
	}

	static async get() {
		if (instance) return instance;
		let schema = await Schema.get();
		instance = new Permission(schema);
		return instance;
	}

	async updateBitmap() {
		const rows = await this.schema.model('Permission').findAll({attributes: ['Name']});
		const permissions = _.pluck(rows, 'Name').sort().join();
		const hash = crypto.createHash('SHA1');
		hash.update(permissions);
		hash.update(String(Math.random()));
		const version = hash.digest('base64').substr(0, 8);
		const bitmap = await this.schema.model('PermissionBitmap').create({
			Version: version,
			Permissions: permissions,
			CreatedAt: new Date()
		});
		return bitmap.get();
	}

	async resolveUserPermissions(userId, permissions) {
		permissions = permissions || [];
		const userGroups = await this.schema.model('UserGroup').findAll({
			where: {UserId: userId},
			order: [['Prio', 'ASC']]
		});
		for (let userGroup of userGroups) {
			let groupId = userGroup.get('GroupId');
			// eslint-disable-next-line no-await-in-loop
			permissions = await this.resolveGroupPermissions(groupId, permissions);
		}

		const userRoles = await this.schema.model('UserRole').findAll({
			where: {UserId: userId},
			order: [['Prio', 'ASC']]
		});
		for (let userRole of userRoles) {
			let roleId = userRole.get('RoleId');
			// eslint-disable-next-line no-await-in-loop
			permissions = await this.resolveRolePermissions(roleId, permissions);
		}
		const userPermissions = await this.schema.model('UserPermission').findAll({
			where: {UserId: userId}, order: [['Prio', 'ASC']]
		});
		for (let userPermission of userPermissions) {
			const mode = userPermission.get("Mode");
			const permission = userPermission.get("PermissionName");
			switch (mode) {
				case 'allowed':
					if (!_.contains(permissions, permission))
						permissions.push(permission);
					break;
				case 'denied':
					permissions = _.without(permissions, permission);
					break;
				default:
					throw new VError('Unexpected value for user permission mode: %s', mode);
			}
		}
		return permissions.sort();
	}

	async resolveGroupPermissions(groupId, permissions) {
		permissions = permissions || [];
		const groupRoles = await this.schema.model('GroupRole').findAll({
			where: {GroupId: groupId},
			order: [['Prio', 'ASC']]
		});
		for (let groupRole of groupRoles) {
			let roleId = groupRole.get('RoleId');
			// eslint-disable-next-line no-await-in-loop
			permissions = await this.resolveRolePermissions(roleId, permissions);
		}
		const groupPermissions = await this.schema.model('GroupPermission').findAll({
			where: {GroupId: groupId}, order: [['Prio', 'ASC']]
		});
		for (let groupPermission of groupPermissions) {
			const mode = groupPermission.get("Mode");
			const permission = groupPermission.get("PermissionName");
			switch (mode) {
				case 'allowed':
					if (!_.contains(permissions, permission))
						permissions.push(permission);
					break;
				case 'denied':
					permissions = _.without(permissions, permission);
					break;
				default:
					throw new VError('Unexpected value for group permission mode: %s', mode);
			}
		}
		return permissions.sort();
	}

	async resolveRolePermissions(roleId, permissions) {
		permissions = permissions || [];
		const rows = await this.schema.model('RolePermission').findAll({
			where: {roleId: roleId}, order: [['Prio', 'ASC']]
		});
		_.each(rows, function (row) {
			const mode = row.get("Mode");
			const permission = row.get("PermissionName");
			switch (mode) {
				case 'allowed':
					if (!_.contains(permissions, permission))
						permissions.push(permission);
					break;
				case 'denied':
					permissions = _.without(permissions, permission);
					break;
				default:
					throw new VError('Unexpected value for role permission mode: %s', mode);
			}
		});
		return permissions.sort();
	}

}

module.exports = Permission;
