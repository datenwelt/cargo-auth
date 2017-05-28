const mocha = require('mocha');
const describe = mocha.describe;
const after = mocha.after;
const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const it = mocha.it;

const assert = require('chai').assert;
const sinon = require('sinon');

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

const UserModel = require(path.join(CWD, 'src/schema/user'));
const TestRouter = require(path.join(CWD, 'src/server/auth/reset-password'));

describe('server/auth/reset-password.js', function () {

	const path = '/reset-password';

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
		state.rsa = await RSA.init(config.rsa);
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
			smtp = null;
			server.server.close(done);
		});
	});

	describe('POST /auth/reset-password', function () {

		beforeEach(async function () {
			await db.query('DELETE FROM PasswordResets');
		});

		it("creates a password reset token for valid users", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			let mailPromise = smtp.waitForMessage();

			let resp = null;
			try {
				resp = await superagent.post(baseURI).send({
					username: 'testman'
				});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}

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
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_NOSTRING',
				superagent.post(baseURI)
					.send({username: {id: 1}}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_BODY_USERNAME_EMPTY',
				superagent.post(baseURI)
					.send({username: ''}));
		});

		it('responds with status 400 when ERR_REQ_USERNAME_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_REQ_USERNAME_UNKNOWN',
				superagent.post(baseURI)
					.send({username: 'testman54666'}));
		});

		it('responds with status 423 when ERR_REQ_LOGIN_SUSPENDED', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(423, 'ERR_REQ_LOGIN_SUSPENDED',
				superagent.post(baseURI)
					.send({username: 'testman-inactive'}));
		});


	});

	describe("POST /auth/reset-password/:token", function () {

		let token = null;

		beforeEach(async function () {
			await db.query('DELETE FROM PasswordResets');
			let passwordReset = await router.createPasswordReset('testman');
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

			let user = await schema.get().model('User').findOne({where: {Username: 'testman'}});
			let oldPassword = user.get('Password');
			let password = 'test.' + Math.floor(Math.random() * 1000) + 1000;
			let resp = null;
			try {
				resp = await superagent.post(baseURI + "/" + token).send({
					password: password
				});
			} catch (err) {
				if (err.response) assert.fail(true, true, util.format('Request failed: %d %s', err.response.status, err.response.get('X-Error')));
				throw err;
			}

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

		it('responds with status 400 when ERR_PARAM_TOKEN_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(400, 'ERR_PARAM_TOKEN_EMPTY',
				superagent.post(baseURI + "/%20")
					.send({password: 'test.123456'}));
		});

		it('responds with status 404 when ERR_REQ_TOKEN_UNKNOWN', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await TestServer.expectErrorResponse(404, 'ERR_REQ_TOKEN_UNKNOWN',
				superagent.post(baseURI + "/xxxxxx")
					.send({password: 'test.123456'}));
		});


	});
});
