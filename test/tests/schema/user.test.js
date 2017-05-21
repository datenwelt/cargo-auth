/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const TestSchema = require('../../test-utils/test-schema');

describe("schema/user.js", function () {

	let schema = null;
	let db = null;

	before(async function () {
		try {
			schema = await TestSchema.get();
			if (!schema) return;
		} catch (err) {
			schema = null;
		}
		try {
			db = await TestSchema.db();
		} catch (err) {
			db = null;
		}
	});

	describe("permissions()", function () {

		it('resolves to the expected permission list', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations (id, name, shortname) VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations (id, name, shortname) VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name) VALUES(1, 'TestRole');
			INSERT INTO Roles (id, name) VALUES(2, 'TestRole2');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 10, 2, 'Administrator');
			DELETE FROM Groups;
			INSERT INTO Groups (Id, Name, OrganizationId) VALUES(1, 'TestGroup', 2);
			INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 2);
			INSERT INTO GroupPermissions (Mode, Prio, GroupId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			DELETE FROM Users;
			DELETE FROM UserOrganizations;
			DELETE FROM UserPermissions;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(1, 'testman', '{SHA1}5896475644013648dde834d8e024a06c0708949d', 'test@testman.de', 1);
			INSERT INTO UserOrganizations (Id, UserId, OrganizationId) VALUES(1, 1, 2);
			INSERT INTO UserGroups (Prio, GroupId, UserOrganizationId) VALUES(10, 1, 1);
			INSERT INTO UserRoles (Prio, UserOrganizationId, RoleId) VALUES(10, 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserOrganizationId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			`;
			await db.query(prepareSql);
			let user = await schema.get().model('User').findOne({ where: {Id: 1}});
			let permissions = await user.permissions();
			assert.property(permissions, '2');
			assert.typeOf(permissions[2], 'array');
			assert.deepEqual(permissions[2], ['Administrator', 'ListOrgCustomers']);
		});
	});

});
