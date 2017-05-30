/* eslint-disable no-unused-vars */
const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;

const Promise = require('bluebird');
const path = require('path');
const superagent = require('superagent');
const util = require('util');
const URI = require('urijs');
const VError = require('verror');

const CWD = process.cwd();
const TestConfig = require(path.join(CWD, 'test/test-utils/test-config'));
const TestSchema = require(path.join(CWD, 'test/test-utils/test-schema'));
const TestServer = require(path.join(CWD, 'test/test-utils/test-server'));

const TestRouter = require(path.join(CWD, 'src/server/assets/users'));

describe('server/assets/users.js', function () {

	const path = '/users';

	let app = null;
	let config = null;
	let router = null;
	let schema = null;
	let server = null;
	let state = {};

	let baseURI = null;

	before(async function () {
		config = await TestConfig.get();
		schema = await TestSchema.get();
		await TestSchema.reset();
		server = await TestServer.start();
		router = new TestRouter('io.cargohub.authd.users', {schema: schema});
		app = await router.init(config, state);
		server.use(path, app);
		server.use(TestServer.createErrorHandler());
		baseURI = new URI(server.uri);
		baseURI.path(path);
		baseURI = baseURI.toString();

	});

	after(function (done) {
		server.server.close(done);
	});

	describe('POST /assets/users', function () {

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('creates a new user', async function () {
			let response = null;
			try {
				response = await superagent.post(baseURI)
					.send({
						username: 'test-user',
						password: 'test.123456',
						email: 'test-user@cargohub.io',
						active: true
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				username: 'test-user',
				password: '{SHA1}efc87ec9ae7172d3f461972b5fecc774485f41ab',
				email: 'test-user@cargohub.io',
				active: true
			});
		});

	});

	describe('GET /assets/users', function () {

		beforeEach(async function () {
			let db = await TestSchema.db();
			await db.query('DELETE FROM Users');
			await Promise.map([1, 2, 3], function (num) {
				let username = 'test-' + num;
				let password = '{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83';
				let email = 'test-' + num + '@cargohub.io';
				let active = 1;
				return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
					username,
					password,
					email,
					active
				]);
			});
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('loads the current users as a list', async function () {
			let resp = null;
			try {
				resp = await superagent.get(baseURI + "?offset=0&limit=15");
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let users = resp.body;
			assert.deepEqual(users, [
				{
					"active": true,
					"email": "test-1@cargohub.io",
					"password": "{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83",
					"username": "test-1"
				},
				{
					"active": true,
					"email": "test-2@cargohub.io",
					"password": "{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83",
					"username": "test-2"
				},
				{
					"active": true,
					"email": "test-3@cargohub.io",
					"password": "{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83",
					"username": "test-3"
				}
			]);
			assert.strictEqual(resp.get('x-list-offset'), "0");
			assert.strictEqual(resp.get('x-list-limit'), "15");
			assert.strictEqual(resp.get('x-list-count'), "3");
			assert.strictEqual(resp.get('x-list-order'), 'username;asc');
		});

	});

	describe('GET /assets/users/:username', function () {

		beforeEach(async function () {
			let db = await TestSchema.db();
			await db.query('DELETE FROM Users');
			await Promise.map([1, 2, 3], function (num) {
				let username = 'test-' + num;
				let password = '{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83';
				let email = 'test-' + num + '@cargohub.io';
				let active = 1;
				return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
					username,
					password,
					email,
					active
				]);
			});
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('loads an existing user', async function () {
			let response = null;
			try {
				response = await superagent.get(baseURI + "/test-1");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				"active": true,
				"email": "test-1@cargohub.io",
				"password": "{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83",
				"username": "test-1",
			});
		});

		it('responds with 404 if the user does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_USER_UNKNOWN',
				superagent.get(baseURI + "/test-user4"));

		});

	});

	describe('POST /assets/users/:username', function () {

		beforeEach(async function () {
			let db = await TestSchema.db();
			await db.query('DELETE FROM Users');
			await Promise.map([1, 2, 3], function (num) {
				let username = 'test-' + num;
				let password = '{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83';
				let email = 'test-' + num + '@cargohub.io';
				let active = 1;
				return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
					username,
					password,
					email,
					active
				]);
			});
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('changes an existing user', async function () {
			let response = null;
			try {
				response = await superagent
					.post(baseURI + "/test-1")
					.send({
						"active": false,
						"email": "testuser-1@cargohub.io",
						"username": "testuser-1",
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				"active": false,
				"email": "testuser-1@cargohub.io",
				"password": "{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83",
				"username": "testuser-1",
			});

		});

		it('responds with 409 ERR_REQ_USER_DUPLICATE when the new user already exists', async function () {
			await TestServer.expectErrorResponse(409, 'ERR_REQ_USER_DUPLICATE',
				superagent.post(baseURI + "/test-1")
					.send({
						"active": false,
						"email": "testuser-1@cargohub.io",
						"username": "test-2",
					}));
		});

		it('responds with 404 ERR_REQ_USER_UNKNOWN when the role does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_USER_UNKNOWN',
				superagent.post(baseURI + "/test-4")
					.send({
						"active": false,
						"email": "testuser-1@cargohub.io",
						"username": "test-2",
					}));
		});

	});


	describe('PUT /assets/users/:username', function () {

		beforeEach(async function () {
			let db = await TestSchema.db();
			await db.query('DELETE FROM Users');
			await Promise.map([1, 2, 3], function (num) {
				let username = 'test-' + num;
				let password = '{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83';
				let email = 'test-' + num + '@cargohub.io';
				let active = 1;
				return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
					username,
					password,
					email,
					active
				]);
			});
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('changes an existing user', async function () {
			let response = null;
			try {
				response = await superagent
					.put(baseURI + "/test-1")
					.send({
						"active": false,
						"email": "testuser-1@cargohub.io",
						"password": "test.6777777"
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				"active": false,
				"email": "testuser-1@cargohub.io",
				"password": "{SHA1}05cc37692e160b37eae23438083a0b4460a9b6f7",
				"username": "test-1",
			});

		});

		it('responds with 404 ERR_REQ_USER_UNKNOWN when the role does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_USER_UNKNOWN',
				superagent.put(baseURI + "/test-4").send({
						"active": false,
						"email": "testuser-1@cargohub.io",
						"password": "test.6777777"
					}));
		});

	});

	describe('DELETE /assets/users/:username', function () {

		beforeEach(async function () {
			let db = await TestSchema.db();
			await db.query('DELETE FROM Users');
			await Promise.map([1, 2, 3], function (num) {
				let username = 'test-' + num;
				let password = '{SHA1}4e1243bd22c66e76c2ba9eddc1f91394e57f9f83';
				let email = 'test-' + num + '@cargohub.io';
				let active = 1;
				return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
					username,
					password,
					email,
					active
				]);
			});
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Users WHERE Username LIKE 'test-%'");
		});

		it('deletes an existing user', async function () {
			let response = null;
			try {
				response = await superagent.delete(baseURI + "/test-1");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {});
		});

		it('responds with 200 when the role does not exist', async function () {
			let response = null;
			try {
				response = await superagent
					.delete(baseURI + "/test-4");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {});
		});

	});
});


