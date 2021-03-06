/* eslint-disable no-unused-vars,max-lines */
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

const TestRouter = require(path.join(CWD, 'src/server/assets/permissions'));

describe('server/assets/permissions.js', function () {

	const path = '/permissions';

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
		router = new TestRouter('io.cargohub.authd.permissions', {schema: schema});
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

	describe('POST /assets/permissions', function () {

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name='test-permission'");
		});

		it('creates a new permission', async function () {
			try {
				let response = await superagent
					.post(baseURI)
					.send({
						name: 'test-permission',
						description: 'Test Permission'
					});
				assert.deepEqual(response.body, {
					name: 'test-permission',
					description: 'Test Permission'
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

	describe('GET /assets/permissions', function () {

		it('loads the current permissions as a list', async function () {
			let resp = null;
			try {
				resp = await superagent.get(baseURI + "?offset=0&limit=15");
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let permissions = resp.body;
			assert.deepEqual(permissions, [
				{
					"description": null,
					"name": "InviteUsers"
				},
				{
					"description": null,
					"name": "ListOrgCustomers"
				},
				{
					"description": null,
					"name": "ListOwnCustomers"
				},
				{
					"description": null,
					"name": "ManageUsers"
				},
				{
					"description": null,
					"name": "SystemReboot"
				}
			]);
			assert.strictEqual(resp.get('x-list-offset'), "0");
			assert.strictEqual(resp.get('x-list-limit'), "15");
			assert.strictEqual(resp.get('x-list-count'), "5");
			assert.strictEqual(resp.get('x-list-order'), 'name;asc');
		});

	});

	describe('DELETE /assets/permissions/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Permissions VALUES('test-permission', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name LIKE 'test-permission%'");
		});

		it('loads an existing permission', async function () {
			let response = null;
			try {
				response = await superagent.get(baseURI + "/test-permission");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-permission',
				description: null
			});
		});

		it('responds with 403 if the permission does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_PERMISSION_UNKNOWN',
				superagent.get(baseURI + "/test-permission1"));
		});

	});

	describe('POST /assets/permissions/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Permissions VALUES('test-permission', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name LIKE 'test-permission%'");
		});

		it('changes an existing permission', async function () {
			let response = null;
			try {
				response = await superagent
					.post(baseURI + "/test-permission")
					.send({
						name: 'test-permission1',
						description: 'Test Permission'
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-permission1',
				description: 'Test Permission'
			});

		});

		it('responds with 409 ERR_REQ_PERMISSION_DUPLICATE when the new permission already exists', async function () {
			await (await TestSchema.db()).query("INSERT INTO Permissions VALUES('test-permission1', NULL)");
			await TestServer.expectErrorResponse(409, 'ERR_REQ_PERMISSION_DUPLICATE',
				superagent.post(baseURI + "/test-permission")
					.send({
						name: 'test-permission1',
						description: 'Test Permission'
					}));
		});

		it('responds with 404 ERR_REQ_PERMISSION_DUPLICATE when the permission does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_PERMISSION_UNKNOWN',
				superagent.post(baseURI + "/test-permission1")
					.send({
						name: 'test-permission1',
						description: 'Test Permission'
					}));
		});

	});


	describe('PUT /assets/permissions/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Permissions VALUES('test-permission', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name LIKE 'test-permission%'");
		});

		it('changes an existing permission', async function () {
			let response = null;
			try {
				response = await superagent
					.put(baseURI + "/test-permission")
					.send({
						description: 'Test Permission'
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				name: 'test-permission',
				description: 'Test Permission'
			});

		});

		it('responds with 404 ERR_REQ_PERMISSION_DUPLICATE when the permission does not exist', async function () {
			await TestServer.expectErrorResponse(404, 'ERR_REQ_PERMISSION_UNKNOWN',
				superagent.put(baseURI + "/test-permission1")
					.send({
						description: 'Test Permission'
					}));
		});

	});

	describe('DELETE /assets/permissions/:name', function () {

		beforeEach(async function () {
			await (await TestSchema.db()).query("INSERT INTO Permissions VALUES('test-permission', NULL)");
		});

		afterEach(async function () {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name LIKE 'test-permission%'");
		});

		it('deletes an existing permission', async function () {
			let response = null;
			try {
				response = await superagent.delete(baseURI + "/test-permission");
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {});
		});

		it('responds with 200 when the permission does not exist', async function () {
			let response = null;
			try {
				response = await superagent.delete(baseURI + "/test-permission1");
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
