/* eslint-disable no-invalid-this,consistent-return */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;

const fs = require('fs');

const TestSchema = require('../../test-utils/test-schema');

describe("schema/group.js", function () {

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
			// eslint-disable-next-line no-invalid-this
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations (id, name, hostname) VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations (id, name, hostname) VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name) VALUES(1, 'TestRole');
			INSERT INTO Roles (id, name) VALUES(2, 'TestRole2');
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

			let group = await schema.get().model('Group').findOne({where: {Id: 1}});
			let permissions = await group.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['ListOrgCustomers', 'ListOwnCustomers']);
		});
	});

	describe('roles()', function() {

		beforeEach(async function() {
			if ( !db ) return this.skip();
			// eslint-disable-next-line no-sync
			const sql = fs.readFileSync('test/data/sql/server-tests.sql', 'utf8');
			await db.query(sql);
		});

		it('returns the correct set of roles for a specific group', async function() {
			let group = await schema.get().model('Group').findById(1);
			let roles = await group.roles();
			assert.isDefined(roles);
			assert.strictEqual(roles.length, 1);
			assert.equal(roles[0], 'sysadmin');
		});

	});

});
