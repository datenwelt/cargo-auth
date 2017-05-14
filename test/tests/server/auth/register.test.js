const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const assert = require("chai").assert;

const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const AuthAPI = require('../../../../src/api/auth');
const RSA = require('../../../../src/utils/rsa');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');
const TestSmtp = require('../../../test-utils/test-smtpout');

const AuthRegistrationRouter = require('../../../../src/server/auth/register');


describe.only("server/auth/register.js", function () {

	let path = "/user/register";

	let api = null;
	let app = null;
	let config = null;
	let db = null;
	let schema = null;
	let rsa = null;
	let smtp = null;

	async function expectErrorResponse(code, error, xhrPromise) {
		try {
			await xhrPromise;
		} catch (err) {
			assert.property(err, 'response');
			const response = err.response;
			assert.equal(response.status, code);
			assert.equal(response.header['x-cargo-error'], error);
		}
	}

	before(async function () {
		config = await TestConfig.get();
		rsa = await RSA.init(config.rsa);
		db = await TestSchema.db();
		app = await TestServer.start();
		schema = await TestSchema.get();
		smtp = await TestSmtp.get();

		api = new AuthAPI('io.carghub.authd.auth');
		await api.init(config);

		const router = new AuthRegistrationRouter('io.cargohub.auth', api);
		const state = {
			schemas: {cargo_auth: schema}
		};
		const appRouter = await router.init(config, state);
		app.use(path, appRouter);
		// eslint-disable-next-line max-params
		app.use(function (err, req, res, next) {
			// Suppress errors on console.
			if ( res.headersSent ) return next(err);
			return res.send();
		});
		app.uri.path(path);

		if (db) {
			const sql = await fs.readFileAsync('test/data/sql/server-tests.sql', 'utf8');
			await db.query(sql);
		}
	});

	after(async function () {
		if ( smtp )
			await TestSmtp.close();
		smtp = null;
	});

	describe("POST /user/register", function () {

		it("renews a valid session", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, session) {
					if (!event.endsWith('.session.renew')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, session: session});
				});
			});

			let resp = await superagent.post(app.uri.toString()).send({
				username: "testman44@testdomain.local",
				email: "testman44@testdomain.local"
			});
			let activation = resp.body;
			assert.isDefined(session);
			assert.typeOf(session, 'object');
			assert.equal(session.username, 'testman');
			assert.equal(session.expiresIn, '4h');
			assert.equal(session.userId, 1);
			assert.property(session, 'id');
			assert.property(session, 'secret');
			assert.property(session, 'token');
			assert.deepEqual(session.permissions, ['Administrator', 'ListOrgCustomers']);
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
			assert.deepEqual(payload.pbm, {vers: latestBitmap.Version, bits: 6});
			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "io.carghub.authd.auth.session.renew");
			assert.deepEqual(eventData.session, session);
		});

		it('responds with status 401 when ERR_MISSING_AUTHORIZATION_HEADER', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_MISSING_AUTHORIZATION_HEADER',
				superagent.post(app.uri.toString() + "/renew")
					.send({}));
		});

		it('responds with status 401 when ERR_AUTHORIZATION_TYPE_NOT_SUPPORTED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_AUTHORIZATION_TYPE_NOT_SUPPORTED',
				superagent.post(app.uri.toString() + "/renew")
					.set('Authorization', 'Basic 34567576567')
					.send({}));
		});

		it('responds with status 401 when ERR_MISSING_AUTHORIZATION_TOKEN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(401, 'ERR_MISSING_AUTHORIZATION_TOKEN',
				superagent.post(app.uri.toString() + "/renew")
					.set('Authorization', 'Bearer')
					.send({}));
		});

		it('responds with status 401 when ERR_INVALID_AUTHORIZATION_TOKEN', function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			return expectErrorResponse(403, 'ERR_INVALID_AUTHORIZATION_TOKEN',
				superagent.post(app.uri.toString() + "/renew")
					.set('Authorization', 'Bearer asdasdasdasd')
					.send({}));
		});
	});

});
