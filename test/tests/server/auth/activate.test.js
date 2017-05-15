const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const afterEach = require("mocha").afterEach;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const assert = require("chai").assert;
const sinon = require('sinon');

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const superagent = require('superagent');

const AuthAPI = require('../../../../src/api/auth');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');
const TestSmtp = require('../../../test-utils/test-smtpout');

const AuthRouter = require('../../../../src/server/auth/activate');


describe("server/auth/activate.js", function () {

	let path = "/activate";

	let api = null;
	let app = null;
	let config = null;
	let db = null;
	let schema = null;
	let smtp = null;

	async function expectErrorResponse(code, error, xhrPromise) {
		try {
			await xhrPromise;
		} catch (err) {
			assert.property(err, 'response');
			const response = err.response;
			assert.equal(response.status, code, "Unexpected status code");
			assert.equal(response.header['x-cargo-error'], error, "Unexpected error header");
			return;
		}
		throw new Error('XMLHttpRequest was successful but should have failed.');
	}

	before(async function () {
		config = await TestConfig.get();
		db = await TestSchema.db();
		app = await TestServer.start();
		schema = await TestSchema.get();
		smtp = await TestSmtp.get();

		api = new AuthAPI('io.carghub.authd.auth');
		await api.init(config, {
			schemas: {cargo_auth: schema}
		});

		const router = new AuthRouter('io.cargohub.auth', api);
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

	after(async function () {
		if (smtp)
			await TestSmtp.close();
		smtp = null;
	});

	describe("POST /auth/activate", function () {

		let token = null;
		let UserModel = null;

		beforeEach(async function () {
			await db.query('DELETE FROM UserActivations');
			await db.query("DELETE FROM Users WHERE Username='testman44@testdomain.local'");
			const activation = await api.registerUser('testman44@testdomain.local', {
				password: 'test.123455'
			});
			token = activation.token;
			UserModel = schema.get().model('User');
			sinon.spy(UserModel, 'checkPassword');
		});

		afterEach(function() {
			UserModel.checkPassword.restore();
		});

		it("activates the user with a valid token", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, data) {
					if (!event.endsWith('.auth.activate')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let resp = await superagent.post(app.uri.toString()).send({
				token: token,
				email: "testman44@testdomain.local"
			});
			let user = resp.body;
			assert.isDefined(user);
			assert.equal(user.username, 'testman44@testdomain.local');
			assert.equal(user.email, 'testman44@testdomain.local');
			assert.isTrue(user.active);
			assert.notProperty(user, 'password');

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "io.carghub.authd.auth.activate");
			assert.deepEqual(eventData.data, user);

		});

		it("calls UserModel.checkPassword() when a password is provided", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			await superagent.post(app.uri.toString()).send({
				token: token,
				email: "testman44@testdomain.local",
				password: "test.1234567"
			});
			assert.isTrue(UserModel.checkPassword.calledWith('test.1234567'), "UserModel.checkPassword() has been called.");

		});


		it('responds with status 400 when ERR_TOKEN_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_TOKEN_INVALID',
				superagent.post(app.uri.toString())
					.send({
						token: {id: 1},
						email: "testman44@testdomain.local"
					}));
		});

		it('responds with status 400 when ERR_TOKEN_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_TOKEN_MISSING',
				superagent.post(app.uri.toString())
					.send({
						token: '',
						email: "testman44@testdomain.local"
					}));
		});

		it('responds with status 400 when ERR_TOKEN_UNKOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(404, 'ERR_TOKEN_UNKOWN',
				superagent.post(app.uri.toString())
					.send({
						token: 'askjdhjahdskjahskjhkjdh',
						email: "testman44@testdomain.local"
					}));
		});

	});

});
