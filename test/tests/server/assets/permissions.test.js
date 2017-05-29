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

const Login = require(path.join(CWD, 'src/server/auth/login'));
const TestRouter = require(path.join(CWD, 'src/server/assets/permissions'));

describe('server/assets/permissions.js', function () {

	const path = '/permissions';

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
		router = new TestRouter('io.cargohub.authd.permissions', {schema: schema});
		app = await router.init(config, state);
		server.use(path, app);
		server.use(TestServer.createErrorHandler());
		baseURI = new URI(server.uri);
		baseURI.path(path);
		baseURI = baseURI.toString();

		await schema.get().model('Permission').create({
			Name: 'auth-admin'
		});
		await schema.get().model('UserPermission').create({
			UserOriginId: '3@localhost',
			PermissionName: 'auth-admin',
			Mode: 'allowed',
			Prio: 10
		});


		let loginApp = new Login('io.cargohub.authd.auth');
		await loginApp.init(config, state);
		let session = await loginApp.login('admin', 'pugeireeQu7o');
		token = session.token;


	});

	after(function (done) {
		server.server.close(done);
	});

	describe('POST /assets/permissions', function () {

		afterEach(async function() {
			await (await TestSchema.db()).query("DELETE FROM Permissions WHERE Name='test-permission'");
		});

		it('creates a new permission', async function () {
			try {
				let response = await superagent
					.post(baseURI)
					.set('Authorization', 'Bearer ' + token)
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
					"Description": null,
					"Name": "auth-admin"
				},
				{
					"Description": null,
					"Name": "InviteUsers"
				},
				{
					"Description": null,
					"Name": "ListOrgCustomers"
				},
				{
					"Description": null,
					"Name": "ListOwnCustomers"
				},
				{
					"Description": null,
					"Name": "ManageUsers"
				},
				{
					"Description": null,
					"Name": "SystemReboot"
				}
			]);
			assert.strictEqual(resp.get('x-list-offset'), "0");
			assert.strictEqual(resp.get('x-list-limit'), "15");
			assert.strictEqual(resp.get('x-list-count'), "6");
			assert.strictEqual(resp.get('x-list-order'), 'name;asc');
		});

	});

});
