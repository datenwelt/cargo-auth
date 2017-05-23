const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const after = require("mocha").after;

const TestSchema = require('../../test-utils/test-schema');

describe("schema/role.js", function () {

	let schema = null;

	before(async function () {
		try {
			schema = await TestSchema.get();
			if (!schema) return;
		} catch (err) {
			schema = null;
		}
	});

	after(async function () {
		await TestSchema.close();
	});

	describe("permissions()", function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('resolves to the expected permission list', async function () {
			const model = schema.get().model('Role');
			let role = await model.findById('admin');
			let permissions = await role.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['SystemReboot']);

			role = await model.findById('auth-system');
			permissions = await role.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['InviteUsers', 'ManageUsers']);

			role = await model.findById('service');
			permissions = await role.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['InviteUsers', 'ListOrgCustomers', 'ListOwnCustomers']);

			role = await model.findById('guest');
			permissions = await role.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, []);
		});
	});

});
