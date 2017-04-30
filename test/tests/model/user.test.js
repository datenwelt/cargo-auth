/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const SchemaUtils = require('../../tests/utils/schema');
const PermissionModel = require('../../../src/model/permission');
const UserModel = require('../../../src/model/user');

describe("model/user.js", function () {

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

	describe("permissions2Bitmap", function () {

		it('Converts user permissions to a bitmap', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions (Name, Description) VALUES('Administrator', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOwnCustomers', NULL);
			DELETE FROM PermissionBitmaps;
			DELETE FROM Users;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active, OrganizationId) VALUES(1, 'testman', '{SHA1}5896475644013648dde834d8e024a06c0708949d', 'test@testman.de', 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 20, 1, 'ListOrgCustomers');
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 10, 1, 'ListOwnCustomers');
			`;
			await db.query(prepareSql);
			const bitmapVersion = await (await PermissionModel.get()).updateBitmap();
			const version = bitmapVersion.Version;
			const bitmap = await (await UserModel.get()).permissions2Bitmap(1);
			assert.strictEqual(bitmap.version, version);
			assert.strictEqual(bitmap.bits, 3);
		});

	});

	describe("bitmap2Permissions", function () {

		it('Converts a bitmap to user permissions', async function () {
			if (!schema) this.skip();
			const prepareSql = `
			DELETE FROM Permissions;
			INSERT INTO Permissions (Name, Description) VALUES('Administrator', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions (Name, Description) VALUES('ListOwnCustomers', NULL);
			DELETE FROM PermissionBitmaps;
			DELETE FROM Users;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active, OrganizationId) VALUES(1, 'testman', '{SHA1}5896475644013648dde834d8e024a06c0708949d', 'test@testman.de', 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 20, 1, 'ListOrgCustomers');
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 10, 1, 'ListOwnCustomers');
			`;
			await db.query(prepareSql);
			const { Version: bitmapVersion } = await (await PermissionModel.get()).updateBitmap();
			const bitmap = 3;
			const permissions = await (await UserModel.get()).bitmap2Permissions(bitmapVersion, bitmap);
			assert.deepEqual(permissions, ['ListOrgCustomers', 'ListOwnCustomers']);
		});
	});

});
