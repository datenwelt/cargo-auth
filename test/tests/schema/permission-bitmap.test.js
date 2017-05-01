/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const SchemaUtils = require('../../test-utils/schema');

describe("schema/permission-bitmap.js", function () {

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

	describe('static createLatest()', function () {

		it('creates a permission bitmap from the permissions in the database', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM PermissionBitmaps;
			`;
			await db.query(prepareSql);
			const permissionBitmap = await schema.model('PermissionBitmap').createLatest();
			assert.typeOf(permissionBitmap.Version, 'string');
			assert.lengthOf(permissionBitmap.Version, 8);
			assert.deepEqual(permissionBitmap.Permissions, 'Administrator,ListOrgCustomers,ListOwnCustomers');
			assert.instanceOf(permissionBitmap.CreatedAt, Date);
			assert.isBelow(permissionBitmap.CreatedAt.getTime(), new Date().getTime());
		});

	});

	describe('permissions2Bitmap()', function() {

		it('converts a permission list to a bitmap', async function() {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions (Name, Description) VALUES('Administrator', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOwnCustomers', NULL);
			DELETE FROM PermissionBitmaps;
			`;
			await db.query(prepareSql);
			const bitmapVersion = await schema.model('PermissionBitmap').createLatest();
			const bitmap = await bitmapVersion.permissionsToBitmap(['ListOrgCustomers', 'ListOwnCustomers']);
			assert.strictEqual(bitmap, 3);
		});

	});

	describe('permissions2Bitmap()', function() {

		it('converts a permission list to a bitmap', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions (Name, Description) VALUES('Administrator', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOwnCustomers', NULL);
			DELETE FROM PermissionBitmaps;
			`;
			await db.query(prepareSql);
			const bitmapVersion = await schema.model('PermissionBitmap').createLatest();
			const bitmap = 3;
			const permissions = await bitmapVersion.bitmapToPermissions(bitmap);
			assert.deepEqual(permissions, ['ListOrgCustomers', 'ListOwnCustomers']);
		});

	});

});
