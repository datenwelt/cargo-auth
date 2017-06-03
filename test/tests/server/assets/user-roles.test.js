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


const TestRouter = require(Path.join(CWD, 'src/server/assets/user-roles'));
const scriptName = 'server/assets/user-roles.js';
const srcPath = '/users';
const srcParamName = ':userUsername';
const dstPath = '/roles';
const dstParamName = ':roleName';
const errorName = 'USER_ROLE';

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
		await db.query('DELETE FROM Roles');
		await db.query('DELETE FROM Users');
		await db.query('DELETE FROM UserRoles');
		await Promise.map([1, 2, 3], function (id) {
			let name = 'role-' + id;
			let description = 'This is test role #' + id;
			return db.execute("INSERT INTO Roles (Name, Description) VALUES(?,?)", [
				name,
				description
			]);
		});
		await Promise.map([1, 2, 3], function (id) {
			let username = 'user-' + id;
			let password = '{SHA1}bdee578ffe5e91e95ad802f67dc377c8c92dabbc';
			let email = username + "@cargohub.io";
			let active = true;
			return db.execute("INSERT INTO Users (Username, Password, Email, Active) VALUES(?,?,?,?)", [
				username, password, email, active
			]);
		});
		await db.query("INSERT iNTO UserRoles (UserUsername, RoleName, Prio) VALUES ('user-1', 'role-1', 20)");
		await db.query("INSERT iNTO UserRoles (UserUsername, RoleName, Prio) VALUES ('user-1', 'role-2', 10)");
	});

	afterEach(async function () {
		let db = await TestSchema.db();
		await db.query('DELETE FROM Roles');
		await db.query('DELETE FROM Users');
		await db.query('DELETE FROM UserRoles');
	});


	describe('POST ' + srcPath + "/" + srcParamName + dstPath, function () {

		it('creates a new item', async function () {
			let response = null;
			try {
				let uri = new URI(baseURI);
				uri.segment([srcPath, 'user-1', dstPath]);
				response = await superagent.post(uri.toString())
					.send({
						roleName: 'role-3',
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
				userUsername: 'user-1',
				roleName: 'role-3',
				prio: 30,
				role: {
					name: 'role-3',
					description: 'This is test role #3'
				}
			});
		});

	});

	describe('GET ' + srcPath + "/" + srcParamName + dstPath, function () {

		it('loads the current items as a list', async function () {
			let resp = null;
			let uri = new URI(baseURI);
			uri.segment([srcPath, 'user-1', dstPath]);
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
					"prio": 10,
					"role": {
						"description": "This is test role #2",
						"name": "role-2"
					},
					"roleName": "role-2",
					"userUsername": "user-1"
				},
				{
					"prio": 20,
					"role": {
						"description": "This is test role #1",
						"name": "role-1",
					},
					"roleName": "role-1",
					"userUsername": "user-1"
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
				uri.segment([srcPath, 'user-1', dstPath, 'role-3']);
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
				uri.segment([srcPath, 'user-1', dstPath, 'role-4']);
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


