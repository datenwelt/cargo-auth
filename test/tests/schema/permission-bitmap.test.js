/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const after = require("mocha").after;

const TestSchema = require('../../test-utils/test-schema');

describe("schema/permission-bitmap.js", function () {

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

	describe('static createLatest()', function () {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('creates a permission bitmap from the permissions in the database', async function () {
			const permissionBitmap = await schema.get().model('PermissionBitmap').createLatest();
			assert.typeOf(permissionBitmap.Version, 'string');
			assert.lengthOf(permissionBitmap.Version, 8);
			assert.deepEqual(permissionBitmap.Permissions, 'InviteUsers,ListOrgCustomers,ListOwnCustomers,ManageUsers,SystemReboot');
			assert.instanceOf(permissionBitmap.CreatedAt, Date);
			assert.isBelow(permissionBitmap.CreatedAt.getTime(), new Date().getTime());
		});

	});

	describe('permissions2Bitmap()', function() {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('converts a permission list to a bitmap', async function() {
			const bitmapVersion = await schema.get().model('PermissionBitmap').createLatest();
			const bitmap = await bitmapVersion.permissionsToBitmap(['ListOrgCustomers', 'ListOwnCustomers']);
			assert.strictEqual(bitmap, 12);
		});

	});

	describe('permissions2Bitmap()', function() {

		beforeEach(async function () {
			await TestSchema.reset();
		});

		it('converts a permission list to a bitmap', async function () {
			const bitmapVersion = await schema.get().model('PermissionBitmap').createLatest();
			const bitmap = 12;
			const permissions = await bitmapVersion.bitmapToPermissions(bitmap);
			assert.deepEqual(permissions, ['ListOrgCustomers', 'ListOwnCustomers']);
		});

	});

});
