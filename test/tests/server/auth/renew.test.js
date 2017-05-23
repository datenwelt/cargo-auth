const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const assert = require("chai").assert;

const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const RSA = require('@datenwelt/cargo-api').RSA;

const AuthAPI = require('../../../../src/api/auth');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');

const AuthSessionRouter = require('../../../../src/server/auth/renew');


describe("server/auth/renew.js", function () {

	let path = "/renew";

	let api = null;
	let app = null;
	let config = null;
	let db = null;
	let schema = null;
	let rsa = null;

	async function expectErrorResponse(code, error, xhrPromise) {
		try {
			await xhrPromise;
		} catch (err) {
			assert.property(err, 'response');
			const response = err.response;
			assert.equal(response.status, code);
			assert.equal(response.header['x-cargo-error'], error);
			return;
		}
		throw new Error('XMLHttpRequest was successful but should have failed.');
	}

	before(async function () {
		config = await TestConfig.get();
		rsa = await RSA.init(config.rsa);
		db = await TestSchema.db();
		app = await TestServer.start();
		schema = await TestSchema.get();

		api = new AuthAPI('io.carghub.authd.auth');
		await api.init(config);

		const router = new AuthSessionRouter('io.cargohub.auth', api);
		const state = {
			schemas: {cargo_auth: schema}
		};
		const appRouter = await router.init(config, state);
		app.use(path, appRouter);
		// eslint-disable-next-line max-params
		app.use(function (err, req, res, next) {
			// Suppress errors on console.
			if (res.headersSent) return next(err);
			return res.send();
		});
		app.uri.path(path);

		if (db) {
			const sql = await fs.readFileAsync('test/data/sql/server-tests.sql', 'utf8');
			await db.query(sql);
		}
	});

	after(function () {

	});

	describe("POST /auth/renew", function () {

		it("renews a valid session", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let oldSession = await api.login("testman", "test123456");

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, session) {
					if (!event.endsWith('.auth.login')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = await superagent.post(app.uri.toString())
				.set('Authorization', 'Bearer ' + oldSession.token)
				.send();
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

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization header is missing', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(app.uri.toString())
					.send({}));
		});

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization type is not supported', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(app.uri.toString())
					.set('Authorization', 'Basic 34567576567')
					.send({}));
		});

		it('responds with status 401/ERR_UNAUTHENTICATED_ACCESS when Authorization token is missing', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(app.uri.toString())
					.set('Authorization', 'Bearer')
					.send({}));
		});

		it('responds with status 401/ERR_INVALID_AUTHORIZATION_TOKEN, ERR_UNAUTHENTICATED_ACCESS when token is invalid', function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			return expectErrorResponse(403, 'ERR_INVALID_AUTHORIZATION_TOKEN, ERR_UNAUTHENTICATED_ACCESS',
				superagent.post(app.uri.toString())
					.set('Authorization', 'Bearer asdasdasdasd')
					.send({}));
		});
	});

});
