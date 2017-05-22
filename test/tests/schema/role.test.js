const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const TestSchema = require('../../test-utils/test-schema');

describe("schema/role.js", function () {

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
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			`;
			await db.query(prepareSql);
			const model = schema.get().model('Role');
			const role = await model.findOne({where: {'Id': 1}});
			let permissions = await role.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['ListOwnCustomers']);
		});
	});

});
