/* eslint-disable no-unused-vars */
const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;

const path = require('path');
const superagent = require('superagent');
const util = require('util');
const URI = require('urijs');
const VError = require('verror');

const CWD = process.cwd();
const TestConfig = require(path.join(CWD, 'test/test-utils/test-config'));
const TestSchema = require(path.join(CWD, 'test/test-utils/test-schema'));
const TestServer = require(path.join(CWD, 'test/test-utils/test-server'));

const TestRouter = require(path.join(CWD, 'src/server/assets/roles'));

describe('server/assets/roles.js', function () {

	const path = '/roles';

	let app = null;
	let config = null;
	let router = null;
	let schema = null;
	let server = null;
	let state = {};
	let token = null;

	let baseURI = null;

	before(async function () {
		config = await TestConfig.get();
		schema = await TestSchema.get();
		await TestSchema.reset();
		server = await TestServer.start();
		router = new TestRouter('io.cargohub.authd.roles', {schema: schema});
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

	describe('POST /assets/roles', function () {

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('creates a new role', async function () {
			try {
				let response = await superagent
					.post(baseURI)
					.send({
						name: 'test-role',
						description: 'Test Role'
					});
				assert.deepEqual(response.body, {
					name: 'test-role',
					description: 'Test Role'
				});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
		});

	});

	describe('GET /assets/roles', function () {

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('loads the current roles as a list', async function () {
			let resp = null;
			try {
				resp = await superagent.get(baseURI + "?offset=0&limit=15");
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let roles = resp.body;
			assert.deepEqual(roles, [
				{
					"description": "Administrator",
					"name": "admin"
				},
				{
					"description": "Authorization System",
					"name": "auth-system"
				},
				{
					"description": "Guest",
					"name": "guest"
				},
				{
					"description": "Service Staff",
					"name": "service"
				}
			]);
			assert.strictEqual(resp.get('x-list-offset'), "0");
			assert.strictEqual(resp.get('x-list-limit'), "15");
			assert.strictEqual(resp.get('x-list-count'), "4");
			assert.strictEqual(resp.get('x-list-order'), 'name;asc');
		});

	});

	describe('DELETE /assets/roles/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Roles VALUES('test-role', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('loads an existing role', async function () {
			let response = null;
			try {
				response = await superagent
					.get(baseURI + "/test-role");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-role',
				description: null
			});
		});

		it('responds with 404 if the role does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_ROLE_UNKNOWN',
				superagent.get(baseURI + "/test-role1"));

		});

	});

	describe('POST /assets/roles/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Roles VALUES('test-role', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('changes an existing role', async function () {
			let response = null;
			try {
				response = await superagent
					.post(baseURI + "/test-role")
					.send({
						name: 'test-role1',
						description: 'Test Role'
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-role1',
				description: 'Test Role'
			});

		});

		it('responds with 409 ERR_REQ_ROLE_DUPLICATE when the new role already exists', async function () {
			await (await TestSchema.db()).query("INSERT INTO Roles VALUES('test-role1', NULL)");
			await TestServer.expectErrorResponse(409, 'ERR_REQ_ROLE_DUPLICATE',
				superagent.post(baseURI + "/test-role")
					.send({
						name: 'test-role1',
						description: 'Test Role'
					}));
		});

		it('responds with 404 ERR_REQ_ROLE_UNKNOWN when the role does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_ROLE_UNKNOWN',
				superagent.post(baseURI + "/test-role1")
					.send({
						name: 'test-role1',
						description: 'Test Role'
					}));
		});

	});


	describe('PUT /assets/roles/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Roles VALUES('test-role', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('changes an existing role', async function () {
			let response = null;
			try {
				response = await superagent
					.put(baseURI + "/test-role")
					.send({
						description: 'Test Role'
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-role',
				description: 'Test Role'
			});

		});

		it('responds with 404 ERR_REQ_ROLE_UNKNOWN when the role does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_ROLE_UNKNOWN',
				superagent.put(baseURI + "/test-role1")
					.send({
						description: 'Test Role'
					}));
		});

	});

	describe('DELETE /assets/roles/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Roles VALUES('test-role', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Roles WHERE Name LIKE 'test-%'");
		});

		it('deletes an existing role', async function () {
			let response = null;
			try {
				response = await superagent.delete(baseURI + "/test-role");
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
					.delete(baseURI + "/test-role1");
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


