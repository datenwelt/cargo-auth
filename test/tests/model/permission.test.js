/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const SchemaUtils = require('../../tests/utils/schema');
const PermissionModel = require('../../../src/model/permission');

describe("model/permission.js", function () {

	let schema = null;
	let db = null;

	before(async function () {
		try {
			schema = await SchemaUtils.schema();
			if (!schema) return;
		} catch (err) {
			schema = null;
		}
		try {
			db = await SchemaUtils.db();
		} catch (err) {
			db = null;
		}
	});


	describe('constructor', function () {

		it('creates an instance with the expected properties', function () {
			const permission = new PermissionModel();
			assert.strictEqual(permission.name, "io.cargohub.permission");
		});

	});

	describe('updateBitmap()', function () {

		it('creates a permission bitmap from the permissions in the database', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			`;
			await db.query(prepareSql);
			const model = await PermissionModel.get();
			const permissionBitmap = await model.updateBitmap();
			assert.typeOf(permissionBitmap.Version, 'string');
			assert.lengthOf(permissionBitmap.Version, 8);
			assert.deepEqual(permissionBitmap.Permissions, 'Administrator,ListOrgCustomers,ListOwnCustomers');
			assert.instanceOf(permissionBitmap.CreatedAt, Date);
			assert.isBelow(permissionBitmap.CreatedAt.getTime(), new Date().getTime());
		});

	});

	describe('resolveRolePermissions()', function () {

		it('resolves to the expected permission list', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name, organizationId) VALUES(1, 'TestRole', 2);
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			`;
			await db.query(prepareSql);
			const model = await PermissionModel.get();
			let permissions = await model.resolveRolePermissions(1);
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['ListOwnCustomers']);
		});

	});

	describe('resolveGroupPermissions()', function () {

		it('resolves to the expected permission list', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name, organizationId) VALUES(1, 'TestRole', 2);
			INSERT INTO Roles (id, name, organizationId) VALUES(2, 'TestRole2', 2);
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			DELETE FROM Groups;
			INSERT INTO Groups VALUES(1, 'TestGroup', 2);
			INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 2);
			INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 1);
			INSERT INTO GroupPermissions (Mode, Prio, GroupId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			`;
			await db.query(prepareSql);
			const model = await PermissionModel.get();
			let permissions = await model.resolveGroupPermissions(1);
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['ListOrgCustomers', 'ListOwnCustomers']);
		});
	});

	describe('resolveUserPermissions()', function () {

		it('resolves to the expected permission list', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name, organizationId) VALUES(1, 'TestRole', 2);
			INSERT INTO Roles (id, name, organizationId) VALUES(2, 'TestRole2', 2);
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 10, 2, 'Administrator');
			DELETE FROM Groups;
			INSERT INTO Groups (Id, Name, OrganizationId) VALUES(1, 'TestGroup', 2);
			INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 2);
			INSERT INTO GroupPermissions (Mode, Prio, GroupId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			DELETE FROM Users;
			DELETE FROM UserPermissions;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active, OrganizationId) VALUES(1, 'testman', '{SHA1}5896475644013648dde834d8e024a06c0708949d', 'test@testman.de', 1, 2);
			INSERT INTO UserGroups (Prio, GroupId, UserId) VALUES(10, 1, 1);
			INSERT INTO UserRoles (Prio, UserId, RoleId) VALUES(10, 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			`;
			await db.query(prepareSql);
			const model = await PermissionModel.get();
			let permissions = await model.resolveUserPermissions(1);
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['Administrator', 'ListOrgCustomers']);
		});
	});
});
