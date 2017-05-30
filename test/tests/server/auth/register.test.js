const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;
const sinon = require('sinon');

const moment = require('moment');
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
const TestRouter = require(path.join(CWD, 'src/server/auth/register'));

describe('server/auth/register.js', function () {

	const path = '/register';

	let app = null;
	let config = null;
	let db = null;
	let router = null;
	let schema = null;
	let server = null;
	let smtp = null;
	let state = {};

	let baseURI = null;

	before(async function () {
		config = await TestConfig.get();
		db = await TestSchema.db();
		schema = await TestSchema.get();
		smtp = await TestSmtp.get();
		await TestSchema.reset();
		server = await TestServer.start();
		router = new TestRouter('io.cargohub.authd', {schema: schema});
		app = await router.init(config, state);
		server.use(path, app);
		server.use(TestServer.createErrorHandler());
		baseURI = new URI(server.uri);
		baseURI.path(path);
		baseURI = baseURI.toString();
	});

	after(function (done) {
		TestSmtp.close().then(function () {
			server.server.close(done);
		});
	});

	describe('POST /auth/register', function () {

		beforeEach(async function () {
			await db.query('DELETE FROM UserActivations');
			sinon.spy(UserModel, 'checkPassword');
		});

		afterEach(function () {
			UserModel.checkPassword.restore();
			router.removeAllListeners();
		});

		it("registers with an activation mail when used with email", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			const testTimestamp = moment();
			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, data) {
					if (!event.endsWith('register')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let mailPromise = smtp.waitForMessage();

			let resp = null;
			try {
				resp = await superagent.post(baseURI).send({
					username: "testman44@testdomain.local",
					email: "testman44@testdomain.local"
				});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let activation = resp.body;
			assert.isDefined(activation);
			assert.isUndefined(activation.token);
			assert.isUndefined(activation.password);
			assert.typeOf(activation, 'object');
			assert.equal(activation.email, 'testman44@testdomain.local');
			assert.equal(activation.username, 'testman44@testdomain.local');
			assert.isTrue(moment(activation.expiresAt).isAfter(testTimestamp.add(48, 'h')));
			let {Id: token} = (await schema.get().model('UserActivation').findOne({
				attributes: ['Id'],
				where: {Username: activation.username}
			})).get();
			assert.match(token, /^[0-9a-f]{40}$/);

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "register");
			assert.deepEqual(eventData.data, activation);

			const msg = await mailPromise;
			assert.isDefined(msg);
			assert.include(msg.header.to.address, 'testman44@testdomain.local');
			assert.include(msg[0], token);
		});

		it("replies with the activation token when used without email", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			const testTimestamp = moment();
			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, data) {
					if (!event.endsWith('register')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let resp = null;
			try {
				resp = await superagent.post(baseURI).send({
					username: "testman44@testdomain.local"
				});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let activation = resp.body;
			assert.isDefined(activation);
			assert.isDefined(activation.token);
			assert.isUndefined(activation.password);
			assert.typeOf(activation, 'object');
			assert.isUndefined(activation.email);
			assert.equal(activation.username, 'testman44@testdomain.local');
			assert.isTrue(moment(activation.expiresAt).isAfter(testTimestamp.add(48, 'h')));
			let token = activation.token;
			assert.match(token, /^[0-9a-f]{40}$/);

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "register");
			assert.deepEqual(eventData.data, activation);

		});

		it.skip("calls UserModel.checkPassword() when a password is provided", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			await superagent.post(baseURI).send({
				username: "testman44@testdomain.local",
				password: "test1234567."
			});
			assert.isTrue(UserModel.checkPassword.calledWith('test1234567.'), "UserModel.checkPassword() has been called.");

		});

		it('responds with status 400 when ERR_BODY_USERNAME_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_NOSTRING',
				superagent.post(baseURI)
					.send({username: {id: 1}, password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_MISSING',
				superagent.post(baseURI)
					.send({password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOWEAK', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOWEAK',
				superagent.post(baseURI)
					.send({username: 'test1', password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_TOOLONG', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			let username = Buffer.alloc(256, 'a', 'utf8').toString('utf8');
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_TOOLONG',
				superagent.post(baseURI)
					.send({username: username, password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_NOSTRING',
				superagent.post(baseURI)
					.send({password: {id: 1}, username: 'test123456'}));
		});

		it('responds with status 400+ERR_BODY_PASSWORD_FORBIDDEN if username === password', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_FORBIDDEN',
				superagent.post(baseURI)
					.send({password: 'test.123456', username: 'test.123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_EMPTY',
				superagent.post(baseURI)
					.send({username: 'test123456', password: ''}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOSHORT', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOSHORT',
				superagent.post(baseURI)
					.send({password: 'test1', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOLONG', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			let password = Buffer.alloc(65, 'a', 'utf8').toString('utf8');
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOLONG',
				superagent.post(baseURI)
					.send({password: password, username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOWEAK', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOWEAK',
				superagent.post(baseURI)
					.send({password: 'testmann', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_EMAIL_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_EMAIL_NOSTRING',
				superagent.post(baseURI)
					.send({email: {}, password: 'test.123456', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_EMAIL_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_EMAIL_EMPTY',
				superagent.post(baseURI)
					.send({username: 'test123456', password: 'test.123456', email: ''}));
		});

		it('responds with status 409 when ERR_REQ_USERNAME_DUPLICATE', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(409, 'ERR_REQ_USERNAME_DUPLICATE',
				superagent.post(baseURI)
					.send({username: 'testman', password: 'test.123456'}));
		});


	});

});
