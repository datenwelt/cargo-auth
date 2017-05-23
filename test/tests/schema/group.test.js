/* eslint-disable no-invalid-this,consistent-return */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const after = require("mocha").after;
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

	after(async function () {
		await TestSchema.close();
	});

	describe("permissions()", function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('resolves to the expected permission list', async function () {
			let group = await schema.get().model('Group').findById(1);
			let permissions = await group.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['InviteUsers', 'ListOrgCustomers', 'ListOwnCustomers', 'SystemReboot']);
		});
	});

	describe('roles()', function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('returns the correct set of roles for a specific group', async function () {
			let group = await schema.get().model('Group').findById(1);
			let roles = await group.roles();
			assert.isDefined(roles);
			assert.strictEqual(roles.length, 1);
			assert.equal(roles[0], 'service');
		});

	});

});
