/* eslint-disable no-unused-vars */
const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;

const Path = require('path');
const Promise = require('bluebird');
const superagent = require('superagent');
const util = require('util');
const URI = require('urijs');
const VError = require('verror');

const CWD = process.cwd();
const TestConfig = require(Path.join(CWD, 'test/test-utils/test-config'));
const TestSchema = require(Path.join(CWD, 'test/test-utils/test-schema'));
const TestServer = require(Path.join(CWD, 'test/test-utils/test-server'));


const TestRouter = require(Path.join(CWD, 'src/server/assets/role-permissions'));
const scriptName = 'server/assets/role-permissions.js';
const srcPath = '/roles';
const srcParamName = ':roleName';
const dstPath = '/permissions';
const dstParamName = ':permissionName';
const errorName = 'ROLE_PERMISSION';

describe(scriptName, function () {

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
		router = new TestRouter('io.cargohub.authd.items', {schema: schema});
		app = await router.init(config, state);
		server.use("/", app);
		server.use(TestServer.createErrorHandler());
		baseURI = new URI(server.uri);
		baseURI = baseURI.toString();
	});

	after(function (done) {
		server.server.close(done);
	});

	beforeEach(async function () {
		let db = await TestSchema.db();
		await db.query('DELETE FROM Permissions');
		await db.query('DELETE FROM Roles');
		await db.query('DELETE FROM RolePermissions');
		await Promise.map([1, 2, 3], function (id) {
			let name = 'permission-' + id;
			let description = 'This is test permission #' + id;
			return db.execute("INSERT INTO Permissions (Name, Description) VALUES(?,?)", [
				name,
				description
			]);
		});
		await Promise.map([1, 2, 3], function (id) {
			let name = 'role-' + id;
			let description = 'This is test role #' + id;
			return db.execute("INSERT INTO Roles (Name, Description) VALUES(?,?)", [
				name,
				description
			]);
		});
		await db.query("INSERT iNTO RolePermissions (RoleName, PermissionName, Mode, Prio) VALUES ('role-1', 'permission-1', 'allowed',  20)");
		await db.query("INSERT iNTO RolePermissions (RoleName, PermissionName, Mode, Prio) VALUES ('role-1', 'permission-2', 'denied', 10)");
	});

	afterEach(async function () {
		let db = await TestSchema.db();
		await db.query('DELETE FROM Permissions');
		await db.query('DELETE FROM Roles');
		await db.query('DELETE FROM RolePermissions');
	});


	describe('POST ' + srcPath + "/" + srcParamName + dstPath, function () {

		it('creates a new item', async function () {
			let response = null;
			try {
				let uri = new URI(baseURI);
				uri.segment([srcPath, 'role-1', dstPath]);
				response = await superagent.post(uri.toString())
					.send({
						permissionName: 'permission-3',
						mode: 'allowed',
						prio: 30
					});
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {
				roleName: 'role-1',
				permissionName: 'permission-3',
				prio: 30,
				mode: 'allowed',
				permission: {
					name: 'permission-3',
					description: 'This is test permission #3'
				}
			});
		});

	});

	describe('GET ' + srcPath + "/" + srcParamName + dstPath, function () {

		it('loads the current items as a list', async function () {
			let resp = null;
			let uri = new URI(baseURI);
			uri.segment([srcPath, 'role-1', dstPath]);
			uri.query({
				offset: 0,
				limit: 15,
				orderBy: 'prio,asc'
			});
			try {
				resp = await superagent.get(uri.toString());
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let groups = resp.body;
			assert.deepEqual(groups, [
				{
					"mode": "denied",
					"permission": {
						"description": "This is test permission #2",
						"name": "permission-2"
					},
					"permissionName": "permission-2",
					"prio": 10,
					"roleName": "role-1",
				},
				{
					"mode": "allowed",
					"permission": {
						"description": "This is test permission #1",
						"name": "permission-1",
					},
					"permissionName": "permission-1",
					"prio": 20,
					"roleName": "role-1"
				}
			]);
			assert.strictEqual(resp.get('x-list-offset'), "0");
			assert.strictEqual(resp.get('x-list-limit'), "15");
			assert.strictEqual(resp.get('x-list-count'), "2");
			assert.strictEqual(resp.get('x-list-order'), 'prio;asc');
		});

	});

	describe('DELETE ' + srcPath + "/" + srcParamName + dstPath + "/" + dstParamName, function () {

		it('deletes an existing item', async function () {
			let response = null;
			try {
				let uri = new URI(baseURI);
				uri.segment([srcPath, 'role-1', dstPath, 'permission-2']);
				response = await superagent.delete(uri.toString());
			} catch (err) {
				if (err.response) {
					assert.strictEqual(err.response.status, 200, util.format('Request failed with status code %d: %s', err.response.status, err.response.get('X-Error')));
					return;
				}
				throw new VError(err);
			}
			assert.deepEqual(response.body, {});
		});

		it('responds with 200 when the item does not exist', async function () {
			let response = null;
			try {
				let uri = new URI(baseURI);
				uri.segment([srcPath, 'role-1', dstPath, 'permission-4']);
				response = await superagent.delete(uri.toString());
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


