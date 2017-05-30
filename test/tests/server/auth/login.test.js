const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;

const jwt = require('jsonwebtoken');
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

const RSA = require('@datenwelt/cargo-api').RSA;
const TestRouter = require(path.join(CWD, 'src/server/auth/login'));

describe('server/auth/login.js', function () {

	const path = '/login';

	let app = null;
	let config = null;
	let db = null;
	let router = null;
	let schema = null;
	let server = null;
	let state = {};

	let baseURI = null;

	before(async function () {
		config = await TestConfig.get();
		db = await TestSchema.db();
		schema = await TestSchema.get();
		state.rsa = await RSA.init(config.rsa);
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
	});

	after(function (done) {
		TestSmtp.close().then(function () {
			server.server.close(done);
		});
	});

	describe('POST /auth/login', function () {

		beforeEach(async function () {
			await db.query('DELETE FROM Sessions');
		});

		afterEach(function () {
			router.removeAllListeners();
		});

		it("performs a login with valid credentials", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, session) {
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = null;
			try {
				resp = await superagent.post(baseURI)
					.send({username: "testman", password: "test123456"});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}
			let session = resp.body;
			assert.isDefined(session);
			assert.typeOf(session, 'object');
			assert.equal(session.username, 'testman');
			assert.equal(session.expiresIn, '4h');
			assert.equal(session.userId, 1);
			assert.property(session, 'id');
			assert.property(session, 'secret');
			assert.property(session, 'token');
			assert.property(session, 'permissions');
			assert.deepEqual(session.permissions, ['InviteUsers', 'ListOrgCustomers']);
			assert.strictEqual(session.expiresIn, '4h');
			assert.isBelow(new Date().getTime(), session.issuedAt * 1000);
			assert.strictEqual(session.username, 'testman');
			assert.strictEqual(session.userId, 1);

			const latestBitmap = await schema.get().model('PermissionBitmap').findLatest();
			const token = session.token;
			const publicKey = state.rsa.exportKey('public');
			const payload = jwt.verify(token, publicKey);
			assert.isDefined(payload);
			assert.deepEqual(payload.usr, {nam: 'testman', id: 1});
			assert.deepEqual(payload.pbm, {vers: latestBitmap.Version, bits: 24});
			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "login");
			assert.deepEqual(eventData.session, session);
		});

		it('responds with status 400 when ERR_BODY_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_MISSING',
				superagent.post(baseURI)
					.send({password: "test123456"}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_NOSTRING',
				superagent.post(baseURI)
					.send({username: {test: 1}, password: "test123456"}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_NOSTRING',
				superagent.post(baseURI)
					.send({username: 'testman', password: {test: 1}}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_PASSWORD_MISSING',
				superagent.post(baseURI)
					.send({username: 'testman'}));
		});

		it('responds with status 403 when ERR_REQ_LOGIN_FAILED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(403, 'ERR_REQ_LOGIN_FAILED',
				superagent.post(baseURI)
					.send({username: 'testman33', password: 'test123456'}));
		});

		it('responds with status 403 when ERR_REQ_LOGIN_FAILED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(403, 'ERR_REQ_LOGIN_FAILED',
				superagent.post(baseURI)
					.send({username: 'testman', password: 'xxxx'}));
		});

		it('responds with status 423 when ERR_REQ_LOGIN_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(423, 'ERR_REQ_LOGIN_SUSPENDED',
				superagent.post(baseURI)
					.send({username: 'testman-inactive', password: 'test123456'}));
		});

		it('responds with status 405 when not using POST', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			// eslint-disable-next-line no-undefined
			await TestServer.expectErrorResponse(405, undefined, superagent.get(baseURI));
		});
	});


});
