/* eslint-disable no-invalid-this,no-console */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const jwt = require('jsonwebtoken');
const VError = require('verror');

const TestConfig = require('../../test-utils/test-config');
const TestSchema = require('../../test-utils/test-schema');
const RSA = require('../../../src/utils/rsa');
const AuthAPI = require('../../../src/api/auth');


let config = null;
let schema = null;
let db = null;
let api = null;
let rsa = null;

describe("api/user.js", function () {

	before(async function () {
		try {
			config = await TestConfig.get();
			rsa = await RSA.init(config.rsa);
			schema = await TestSchema.get();
			db = await TestSchema.db();
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
			DELETE FROM Sessions;
			DELETE FROM Users;
			DELETE FROM UserPermissions;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(1, 'testman', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 1);
			INSERT INTO UserGroups (Prio, GroupId, UserId) VALUES(10, 1, 1);
			INSERT INTO UserRoles (Prio, UserId, RoleId) VALUES(10, 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(2, 'testman-inactive', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 0);
			`;
			if (db) {
				await db.query(prepareSql);
			}
		} catch (err) {
			console.log(err);
			db = false;
		}
		api = await new AuthAPI("io.cargohub.auth").init(config, {schemas: {cargo_auth: schema}});
	});

	describe('login()', function () {

		it('returns a valid session on successful login', async function () {
			if (!db) this.skip();
			const session = await api.login('testman', 'test123456');
			assert.isDefined(session);
			assert.typeOf(session, 'object');
			assert.isDefined(session.token);
			assert.deepEqual(session.permissions, ['Administrator', 'ListOrgCustomers']);
			assert.strictEqual(session.expiresIn, '4h');
			assert.isBelow(new Date().getTime(), session.issuedAt * 1000);
			assert.strictEqual(session.username, 'testman');
			assert.strictEqual(session.userId, 1);

			const latestBitmap = await schema.get().model('PermissionBitmap').findLatest();
			const token = session.token;
			const publicKey = rsa.exportKey('public');
			const payload = jwt.verify(token, publicKey);
			assert.isDefined(payload);
			assert.deepEqual(payload.usr, {nam: 'testman', id: 1});
			assert.deepEqual(payload.pbm, {vers: latestBitmap.Version, bits: 6});
		});

		it('emits a login event on successful login', function (done) {
			if (!db) this.skip();
			new AuthAPI("io.cargohub.auth").init(config, {schemas: {cargo_auth: schema}}).then(function(api) {
				api.onAny(function (eventName, eventPayload) {
					api.removeAllListeners();
					try {
						assert.strictEqual(eventName, 'io.cargohub.auth.login');
						assert.isDefined(eventPayload);
						done();
					} catch (err) {
						done(err);
					}
				});
				api.login('testman', 'test123456');
			});
		});

		it('throws ERR_USERNAME_MISSING', async function () {
			if (!db) this.skip();
			try {
				await api.login(null, 'test123456');
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_USERNAME_MISSING');
			}
		});

		it('throws ERR_USERNAME_INVALID', async function () {
			if (!db) this.skip();
			try {
				await api.login({test: 1}, 'test123456');
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_USERNAME_INVALID');
			}
		});

		it('throws ERR_PASSWORD_MISSING', async function () {
			if (!db) this.skip();
			try {
				await api.login('testman', null);
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_PASSWORD_MISSING');
			}
		});

		it('throws ERR_PASSWORD_INVALID', async function () {
			if (!db) this.skip();
			try {
				await api.login('testman', {test: 1});
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_PASSWORD_INVALID');
			}
		});

		it('throws ERR_UNKNOWN_USER', async function () {
			if (!db) this.skip();
			try {
				await api.login('testman2', 'test123456');
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_UNKNOWN_USER');
			}
		});

		it('throws ERR_LOGIN_FAILED', async function () {
			if (!db) this.skip();
			try {
				await api.login('testman', 'test1234567');
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_LOGIN_FAILED');
			}
		});

		it('throws ERR_LOGIN_SUSPENDED', async function () {
			if (!db) this.skip();
			try {
				await api.login('testman-inactive', 'test1234567');
			} catch (err) {
				assert.instanceOf(err, VError);
				assert.strictEqual(err.name, 'CargoModelError');
				assert.strictEqual(err.code, 'ERR_LOGIN_SUSPENDED');
			}
		});
	});

});
