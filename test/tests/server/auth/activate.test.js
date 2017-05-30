const mocha = require('mocha');
const assert = require('chai').assert;
const sinon = require('sinon');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const path = require('path');
const superagent = require('superagent');
const util = require('util');
const Promise = require('bluebird');

const URI = require('urijs');

const CWD = process.cwd();
const TestConfig = require(path.join(CWD, 'test/test-utils/test-config'));
const TestSchema = require(path.join(CWD, 'test/test-utils/test-schema'));
const TestServer = require(path.join(CWD, 'test/test-utils/test-server'));
const TestSmtp = require(path.join(CWD, 'test/test-utils/test-smtpout'));

const UserModel = require(path.join(CWD, 'src/schema/user'));
const TestRouter = require(path.join(CWD, 'src/server/auth/activate'));

const Register = require(path.join(CWD, 'src/server/auth/register'));

describe('server/auth/activate.js', function () {

	const path = '/activate';

	let app = null;
	let config = null;
	let db = null;
	let router = null;
	let schema = null;
	let server = null;
	let state = {};
	let token = null;

	let register = null;

	let baseURI = null;

	before(async function () {
		config = await TestConfig.get();
		db = await TestSchema.db();
		schema = await TestSchema.get();
		await TestSmtp.get();
		await TestSchema.reset();
		server = await TestServer.start();
		router = new TestRouter('io.cargohub.authd', {schema: schema});
		app = await router.init(config, state);
		server.use(path, app);
		server.use(TestServer.createErrorHandler());
		baseURI = new URI(server.uri);
		baseURI.path(path);
		baseURI = baseURI.toString();

		register = new Register('io.cargohub.authd', {schema: schema});
		await register.init(config, state);
	});

	after(function (done) {
		TestSmtp.close().then(function () {
			server.server.close(done);
		});
	});

	describe('POST /auth/activate', function () {

		beforeEach(async function () {
			await db.query('DELETE FROM UserActivations');
			await db.query("DELETE FROM Users WHERE Username='testman44@testdomain.local'");
			const activation = await register.registerUser('testman44@testdomain.local', {
				password: 'test.123455'
			});
			token = activation.token;
			sinon.spy(UserModel, 'checkPassword');
		});

		afterEach(function () {
			UserModel.checkPassword.restore();
			router.removeAllListeners();
		});

		it("activates the user with a valid token", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, data) {
					if (!event.endsWith('activate')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let resp = null;

			try {
				resp = await superagent.post(baseURI).send({
					token: token,
					email: "testman44@testdomain.local"
				});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let user = resp.body;
			assert.isDefined(user);
			assert.equal(user.username, 'testman44@testdomain.local');
			assert.equal(user.email, 'testman44@testdomain.local');
			assert.isTrue(user.active);
			assert.notProperty(user, 'password');

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "activate");
			assert.deepEqual(eventData.data, user);

		});

		it.skip("calls UserModel.checkPassword() when a password is provided", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			try {
				await superagent.post(baseURI).send({
					token: token,
					email: "testman44@testdomain.local",
					password: "test.1234567"
				});
				assert.isTrue(UserModel.checkPassword.calledWith('test.1234567'), "UserModel.checkPassword() has been called.");
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
		});

		it('responds with status 400 when ERR_BODY_TOKEN_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_TOKEN_NOSTRING',
				superagent.post(baseURI)
					.send({
						token: {id: 1},
						email: "testman44@testdomain.local"
					}));
		});

		it('responds with status 400 when ERR_BODY_TOKEN_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_TOKEN_MISSING',
				superagent.post(baseURI)
					.send({
						email: "testman44@testdomain.local"
					}));
		});

		it('responds with status 400 when ERR_BODY_TOKEN_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_TOKEN_EMPTY',
				superagent.post(baseURI)
					.send({
						token: '',
						email: "testman44@testdomain.local"
					}));
		});

		it('responds with status 404 when ERR_BODY_TOKEN_UNKOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(404, 'ERR_BODY_TOKEN_UNKOWN',
				superagent.post(baseURI)
					.send({
						token: '220b173657aeda3d47a7912a226793f6be47dbc8',
						email: "testman44@testdomain.local"
					}));
		});
	});

});
