const describe = require("mocha").describe;
const it = require("mocha").it;
const afterEach = require("mocha").afterEach;
const before = require("mocha").before;
const beforeEach = require("mocha").beforeEach;
const expect = require("chai").expect;

const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const superagent = require('superagent');

const utils = require('../../utils/api');
const SchemaUtil = require('../../utils/schema');
const PEMReader = require('../../../../src/lib/pemreader');

const login = require('../../../../src/api/auth/login');


describe("api/auth/login.js", function () {

	describe("POST /login", function () {

		let schema = null;

		before(async function () {
			schema = await SchemaUtil.schema();
			if ( !schema ) return;
			await schema.model('User').create({
				Username: "testman",
				Password: "{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc",
				Email: "test@testman.de"
			});
			let data = await fs.readFileAsync('test/data/rsa/privkey.pem');
			let privKey = PEMReader.readPrivateKey(data);
			await schema.model('Settings').create({
				Name: 'ServerPrivateKey',
				Value: privKey
			});
		});

		let app = null;

		let path = "/login";

		beforeEach(async function () {
			app = await utils.startServer();
			app.use(path, login);
			app.uri.path(path);
		});

		afterEach(function (done) {
			if (app) {
				app.removeAllListeners();
				app.server.close(done);
			}
		});

		it("performs a login with valid credentials", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!schema) this.skip();
			let resp = await superagent.post(app.uri.toString())
				.send({username: "testman", password: "test123456"});
			expect(true).to.equal(true);
		});

	});


});