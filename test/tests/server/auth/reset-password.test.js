const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const assert = require("chai").assert;

const moment = require('moment');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const superagent = require('superagent');

const AuthAPI = require('../../../../src/api/auth');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');
const TestSmtp = require('../../../test-utils/test-smtpout');

const AuthRouter = require('../../../../src/server/auth/reset-password');


describe("server/auth/reset-password.js", function () {

	let path = "/reset-password";

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
		await api.init(config);

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

	describe("POST /auth/reset-password", function () {

		beforeEach(async function () {
			await db.query('DELETE FROM PasswordResets');
		});

		it("creates a password reset token for valid users", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let mailPromise = smtp.waitForMessage();

			let resp = await superagent.post(app.uri.toString()).send({
				username: 'testman'
			});
			let passwordReset = resp.body;
			assert.isDefined(passwordReset);

			const mail = await mailPromise;
			assert.isDefined(mail);
			assert.include(mail.header.to.address, 'test@testman.de');
			assert.include(mail[0], passwordReset.token);

		});


		it('responds with status 400 when ERR_USERNAME_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_USERNAME_INVALID',
				superagent.post(app.uri.toString())
					.send({username: {id: 1}}));
		});

		it('responds with status 400 when ERR_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_USERNAME_MISSING',
				superagent.post(app.uri.toString())
					.send({username: ''}));
		});

		it('responds with status 400 when ERR_USERNAME_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_USERNAME_UNKNOWN',
				superagent.post(app.uri.toString())
					.send({username: 'testman54666'}));
		});

		it('responds with status 423 when ERR_USERNAME_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(423, 'ERR_USERNAME_SUSPENDED',
				superagent.post(app.uri.toString())
					.send({username: 'testman-inactive'}));
		});

	});

	describe("POST /auth/reset-password/:token", function () {

		let token = null;
		beforeEach(async function () {
			await db.query('DELETE FROM PasswordResets');
			let passwordReset = await api.createPasswordReset('testman');
			token = passwordReset.token;
		});

		it("resets the user password with a valid token", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				api.onAny(function (event, data) {
					if (!event.endsWith('.password-reset')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let user = await schema.get().model('User').findOne({ where: { Username: 'testman'}});
			let oldPassword = user.get('Password');

			let resp = await superagent.post(app.uri.toString() + "/" + token).send({
				password: 'test.' + Math.floor((Math.random()*100000)+100000)
			});
			let response = resp.body;
			assert.isDefined(response);

			await user.reload();

			let newPassword = user.get('Password');
			assert.notEqual(newPassword, oldPassword, "Password is changed after reset");

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "io.carghub.authd.auth.password-reset");
			assert.deepEqual(eventData.data, {username: 'testman'});

		});

		it('responds with status 400 when ERR_TOKEN_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_TOKEN_MISSING',
				superagent.post(app.uri.toString() + "/%20")
					.send({password: 'test.123456'}));
		});

		it('responds with status 404 when ERR_TOKEN_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(404, 'ERR_TOKEN_UNKNOWN',
				superagent.post(app.uri.toString() + "/xxxxxx")
					.send({password: 'test.123456'}));
		});


	});

});
