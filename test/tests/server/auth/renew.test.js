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
const TestRouter = require(path.join(CWD, 'src/server/auth/renew'));

const Login = require(path.join(CWD, 'src/server/auth/login'));

describe('server/auth/renew.js', function () {

	const path = '/renew';

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

	describe('POST /auth/renew', function () {

		it("renews a valid session", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			const loginRouter = new Login('testrouter', { schema: schema, rsa: state.rsa});
			await loginRouter.init(config);
			let oldSession = await loginRouter.login("testman", "test123456");

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, session) {
					if (!event.endsWith('login')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = null;
			try {
				resp = await superagent.post(baseURI)
					.set('Authorization', 'Bearer ' + oldSession.token)
					.send();
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
			assert.property(session.permissions, 'localhost');
			assert.deepEqual(session.permissions.localhost, ['InviteUsers', 'ListOrgCustomers']);
			assert.strictEqual(session.expiresIn, '4h');
			assert.isBelow(new Date().getTime(), session.issuedAt * 1000);
			assert.strictEqual(session.username, 'testman');
			assert.strictEqual(session.userId, 1);

			assert.notEqual(session.id, oldSession.id);

			const latestBitmap = await schema.get().model('PermissionBitmap').findLatest();
			const token = session.token;
			const publicKey = state.rsa.exportKey('public');
			const payload = jwt.verify(token, publicKey);
			assert.isDefined(payload);
			assert.deepEqual(payload.usr, {nam: 'testman', id: 1});
			assert.deepEqual(payload.pbm, {vers: latestBitmap.Version, bits: {"localhost": 24, "test.cargohub.io": 0}});
			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "login");
			assert.deepEqual(eventData.session, session);
		});

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization header is missing', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(baseURI)
					.send({}));
		});

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization type is not supported', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(baseURI)
					.set('Authorization', 'Basic 34567576567')
					.send({}));
		});

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization token is missing', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(baseURI)
					.set('Authorization', 'Bearer')
					.send({}));
		});

		it('responds with status 401/ERR_INVALID_AUTHORIZATION_TOKEN, ERR_UNAUTHENTICATED_ACCESS when token is invalid', function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			return TestServer.expectErrorResponse(403, 'ERR_INVALID_AUTHORIZATION_TOKEN',
				superagent.post(baseURI)
					.set('Authorization', 'Bearer asdasdasdasd')
					.send({}));
		});
	});

});
