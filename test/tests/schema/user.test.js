/* eslint-disable no-invalid-this,no-sync,consistent-return */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const after = require("mocha").after;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;

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

	after(async function () {
		await TestSchema.close();
	});

	describe("permissions()", function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('resolves to the expected permission list', async function () {
			let user = await schema.get().model('User').findOne({where: {Id: 1}});
			let permissions = await user.permissions();
			assert.typeOf(permissions, 'array');
			assert.deepEqual(permissions, ['InviteUsers', 'ListOrgCustomers']);
		});
	});

	describe("roles()", function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it("loads an object containing the organization specific roles.", async function() {
			if ( !db ) return this.skip();
			let user = await schema.get().model('User').findById(1);
			let roles = await user.roles();
			assert.isDefined(roles);
			assert.deepEqual(roles, ['service', 'admin']);
		});

	});

});
