const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const assert = require("chai").assert;

const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');

const AuthAPI = require('../../../../src/api/auth');
const RSA = require('../../../../src/utils/rsa');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');

const AuthLoginRouter = require('../../../../src/server/auth/login');


describe("server/auth/login.js", function () {

	let path = "/login";

	let api = null;
	let app = null;
	let config = null;
	let db = null;
	let schema = null;
	let rsa = null;

	before(async function () {
		config = await TestConfig.get();
		rsa = await RSA.init(config.rsa);
		db = await TestSchema.db();
		app = await TestServer.start();
		schema = await TestSchema.get();
		api = new AuthAPI('io.carghub.authd.auth');
		await api.init(config);

		const router = new AuthLoginRouter('io.cargohub.auth', api);
		const state = {
			schemas: {cargo_auth: schema}
		};
		const appRouter = await router.init(config, state);
		app.use(path, appRouter);
		app.uri.path(path);

		const sql = `
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
			await db.query(sql);
		}
	});

	after(function () {

	});

	describe("POST /auth/login", function () {


		it("performs a login with valid credentials", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, session) {
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = await superagent.post(app.uri.toString())
				.send({username: "testman", password: "test123456"});
			let session = resp.body;
			assert.isDefined(session);
			assert.typeOf(session, 'object');
			assert.equal(session.username, 'testman');
			assert.equal(session.expiresIn, '4h');
			assert.equal(session.userId, 1);
			assert.property(session, 'id');
			assert.property(session, 'secret');
			assert.property(session, 'token');
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
			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "io.carghub.authd.auth.login");
			assert.deepEqual(eventData.session, session);
		});

		it('responds with status 400 when ERR_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({password: "test123456"});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_USERNAME_MISSING');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_USERNAME_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: {test: 1}, password: "test123456"});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_USERNAME_INVALID');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_PASSWORD_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_PASSWORD_MISSING');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_PASSWORD_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman', password: {test: 1}});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_PASSWORD_INVALID');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 400 when ERR_UNKNOWN_USER', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman33', password: 'test123456'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_UNKNOWN_USER');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 403 when ERR_LOGIN_FAILED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman', password: 'xxxx'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 403);
				assert.equal(response.header['x-cargo-error'], 'ERR_LOGIN_FAILED');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 503 when ERR_LOGIN_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman-inactive', password: 'test123456'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 423);
				assert.equal(response.header['x-cargo-error'], 'ERR_LOGIN_SUSPENDED');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 405 when not using POST', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.get(app.uri.toString());
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 405);
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});
	});


});
