const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const assert = require("chai").assert;

const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');

const RSA = require('@datenwelt/cargo-api').RSA;

const AuthAPI = require('../../../../src/api/auth');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');

const AuthLoginRouter = require('../../../../src/server/auth/login');


describe("server/auth/login.js", function () {

	let path = "/login";

	let api = null;
	let app = null;
	let config = null;
	let schema = null;
	let rsa = null;

	before(async function () {
		config = await TestConfig.get();
		rsa = await RSA.init(config.rsa);
		db = await TestSchema.db();
		app = await TestServer.start();
		schema = await TestSchema.get();
		await TestSchema.reset();
		api = new AuthAPI('io.carghub.authd.auth');
		await api.init(config);

		const router = new AuthLoginRouter('io.cargohub.auth', api);
		const state = {
			schemas: {cargo_auth: schema}
		};
		const appRouter = await router.init(config, state);
		app.use(path, appRouter);
		app.uri.path(path);
	});

	after(async function () {
		await TestSchema.close();
	});

	describe("POST /auth/login", function () {

		it("performs a login with valid credentials", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, session) {
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = await superagent.post(app.uri.toString())
				.send({username: "testman", password: "test123456"});
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

			const latestBitmap = await schema.get().model('PermissionBitmap').findLatest();
			const token = session.token;
			const publicKey = rsa.exportKey('public');
			const payload = jwt.verify(token, publicKey);
			assert.isDefined(payload);
			assert.deepEqual(payload.usr, {nam: 'testman', id: 1});
			assert.deepEqual(payload.pbm, {vers: latestBitmap.Version, bits: {"localhost": 24, "test.cargohub.io": 0}});
			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "io.carghub.authd.auth.login");
			assert.deepEqual(eventData.session, session);
		});

		it('responds with status 400 when ERR_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({password: "test123456"});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_USERNAME_MISSING');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_USERNAME_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: {test: 1}, password: "test123456"});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_USERNAME_INVALID');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_PASSWORD_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_PASSWORD_MISSING');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');
		});

		it('responds with status 400 when ERR_PASSWORD_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman', password: {test: 1}});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_PASSWORD_INVALID');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 400 when ERR_UNKNOWN_USER', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman33', password: 'test123456'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 400);
				assert.equal(response.header['x-cargo-error'], 'ERR_UNKNOWN_USER');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 403 when ERR_LOGIN_FAILED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman', password: 'xxxx'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 403);
				assert.equal(response.header['x-cargo-error'], 'ERR_LOGIN_FAILED');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 503 when ERR_LOGIN_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.post(app.uri.toString())
					.send({username: 'testman-inactive', password: 'test123456'});
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 423);
				assert.equal(response.header['x-cargo-error'], 'ERR_LOGIN_SUSPENDED');
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});

		it('responds with status 405 when not using POST', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			try {
				await superagent.get(app.uri.toString());
			} catch (err) {
				assert.property(err, 'response');
				const response = err.response;
				assert.equal(response.status, 405);
				return;
			}
			throw new Error('XMLHttpRequest was successful but should have failed.');

		});
	});


});
