/* eslint-disable max-lines */
const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const afterEach = require("mocha").afterEach;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const assert = require("chai").assert;
const sinon = require("sinon");

const moment = require('moment');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const superagent = require('superagent');

const TestServer = require('../../../test-utils/test-server');
const TestSchema = require('../../../test-utils/test-schema');
const TestConfig = require('../../../test-utils/test-config');
const TestSmtp = require('../../../test-utils/test-smtpout');

const AuthRegistrationRouter = require('../../../../src/server/auth/register');


describe("server/auth/register.js", function () {

	let path = "/register";

	let app = null;
	let config = null;
	let db = null;
	let router = null;
	let schema = null;
	let smtp = null;

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

		router = new AuthRegistrationRouter('io.cargohub.auth', {schema: schema});
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

	describe("POST /auth/register", function () {

		let UserModel = null;

		beforeEach(async function () {
			await db.query('DELETE FROM UserActivations');
			UserModel = schema.get().model('User');
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

			let resp = await superagent.post(app.uri.toString()).send({
				username: "testman44@testdomain.local",
				email: "testman44@testdomain.local"
			});
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

			let resp = await superagent.post(app.uri.toString()).send({
				username: "testman44@testdomain.local"
			});
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

		it("calls UserModel.checkPassword() when a password is provided", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();

			await superagent.post(app.uri.toString()).send({
				username: "testman44@testdomain.local",
				password: "test1234567."
			});
			assert.isTrue(UserModel.checkPassword.calledWith('test1234567.'), "UserModel.checkPassword() has been called.");

		});

		it('responds with status 400 when ERR_BODY_USERNAME_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_USERNAME_INVALID',
				superagent.post(app.uri.toString())
					.send({username: {id: 1}, password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_MISSING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_USERNAME_MISSING',
				superagent.post(app.uri.toString())
					.send({password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOWEAK', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOWEAK',
				superagent.post(app.uri.toString())
					.send({username: 'test1', password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_USERNAME_TOOLONG', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			let username = Buffer.alloc(256, 'a', 'utf8').toString('utf8');
			await expectErrorResponse(400, 'ERR_BODY_USERNAME_TOOLONG',
				superagent.post(app.uri.toString())
					.send({username: username, password: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_NOSTRING', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_NOSTRING',
				superagent.post(app.uri.toString())
					.send({password: {id: 1}, username: 'test123456'}));
		});

		it('responds with status 400+ERR_BODY_PASSWORD_INVALID if username === password', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_INVALID',
				superagent.post(app.uri.toString())
					.send({password: 'test.123456', username: 'test.123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_EMPTY',
				superagent.post(app.uri.toString())
					.send({username: 'test123456', password: ''}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOSHORT', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOSHORT',
				superagent.post(app.uri.toString())
					.send({password: 'test1', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOLONG', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			let password = Buffer.alloc(65, 'a', 'utf8').toString('utf8');
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOLONG',
				superagent.post(app.uri.toString())
					.send({password: password, username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_PASSWORD_TOOWEAK', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_PASSWORD_TOOWEAK',
				superagent.post(app.uri.toString())
					.send({password: 'testmann', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_EMAIL_INVALID', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_EMAIL_INVALID',
				superagent.post(app.uri.toString())
					.send({email: {}, password: 'test.123456', username: 'test123456'}));
		});

		it('responds with status 400 when ERR_BODY_EMAIL_EMPTY', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(400, 'ERR_BODY_EMAIL_EMPTY',
				superagent.post(app.uri.toString())
					.send({username: 'test123456', password: 'test.123456', email: ''}));
		});

		it('responds with status 409 when ERR_REQ_USERNAME_DUPLICATE', async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app) this.skip();
			await expectErrorResponse(409, 'ERR_REQ_USERNAME_DUPLICATE',
				superagent.post(app.uri.toString())
					.send({username: 'testman', password: 'test.123456'}));
		});
	});

});
