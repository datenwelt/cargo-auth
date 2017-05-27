const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const afterEach = require("mocha").afterEach;
const assert = require("chai").assert;

const sinon = require('sinon');

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const superagent = require('superagent');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');
const TestSmtp = require('../../../test-utils/test-smtpout');

const AuthRouter = require('../../../../src/server/auth/reset-password');


describe("server/auth/reset-password.js", function () {

	let path = "/reset-password";

	let app = null;
	let config = null;
	let db = null;
	let schema = null;
	let smtp = null;
	let router = null;

	async function expectErrorResponse(code, error, xhrPromise) {
		try {
			await xhrPromise;
		} catch (err) {
			assert.property(err, 'response');
			const response = err.response;
			assert.equal(response.status, code, "Unexpected status code");
			assert.equal(response.header['x-error'], error, "Unexpected error header");
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

		router = new AuthRouter('io.cargohub.auth', {schema: schema});
		const appRouter = await router.init(config);
		app.use(path, appRouter);
		// eslint-disable-next-line max-params
		app.use(TestServer.createErrorHandler());
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


		it('responds with status 400 when ERR_BODY_USERNAME_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_USERNAME_NOSTRING',
				superagent.post(app.uri.toString())
					.send({username: {id: 1}}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_USERNAME_EMPTY',
				superagent.post(app.uri.toString())
					.send({username: ''}));
		});

		it('responds with status 400 when ERR_REQ_USERNAME_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_REQ_USERNAME_UNKNOWN',
				superagent.post(app.uri.toString())
					.send({username: 'testman54666'}));
		});

		it('responds with status 423 when ERR_REQ_LOGIN_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(423, 'ERR_REQ_LOGIN_SUSPENDED',
				superagent.post(app.uri.toString())
					.send({username: 'testman-inactive'}));
		});

	});

	describe("POST /auth/reset-password/:token", function () {

		let token = null;
		let UserModel = null;

		beforeEach(async function () {
			await db.query('DELETE FROM PasswordResets');
			let passwordReset = await router.createPasswordReset('testman');
			UserModel = schema.get().model('User');
			token = passwordReset.token;
			sinon.spy(UserModel, 'checkPassword');
		});

		afterEach(function () {
			UserModel.checkPassword.restore();
		});

		it("resets the user password with a valid token", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let eventPromise = new Promise(function (resolve, reject) {
				let eventTimeout = setTimeout(function () {
					clearTimeout(eventTimeout);
					reject(new Error('Timeout waiting on event.'));
				}, 2000);
				router.onAny(function (event, data) {
					if (!event.endsWith('password-reset')) return;
					clearTimeout(eventTimeout);
					resolve({event: event, data: data});
				});
			});

			let user = await UserModel.findOne({where: {Username: 'testman'}});
			let oldPassword = user.get('Password');
			let password = 'test.' + Math.floor(Math.random() * 1000) + 1000;
			let resp = await superagent.post(app.uri.toString() + "/" + token).send({
				password: password
			});

			let response = resp.body;
			assert.isDefined(response);

			assert.isTrue(UserModel.checkPassword.calledWith(password), "UserModel.checkPassword() has been called");

			await user.reload();

			let newPassword = user.get('Password');
			assert.notEqual(newPassword, oldPassword, "Password is changed after reset");

			const eventData = await eventPromise;
			assert.isDefined(eventData);
			assert.equal(eventData.event, "password-reset");
			assert.deepEqual(eventData.data, {username: 'testman'});

		});

		it('responds with status 400 when ERR_REQ_TOKEN_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_REQ_TOKEN_EMPTY',
				superagent.post(app.uri.toString() + "/%20")
					.send({password: 'test.123456'}));
		});

		it('responds with status 404 when ERR_REQ_TOKEN_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(404, 'ERR_REQ_TOKEN_UNKNOWN',
				superagent.post(app.uri.toString() + "/xxxxxx")
					.send({password: 'test.123456'}));
		});


	});

});
