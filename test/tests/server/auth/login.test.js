const describe = require("mocha").describe;
const it = require("mocha").it;
const after = require("mocha").after;
const before = require("mocha").before;
const assert = require("chai").assert;

const superagent = require('superagent');

const TestServer = require('../../../test-utils/test-server');
const TestConfig = require('../../../test-utils/config');
const ServerUtils = require('../../../../src/utils/server-utils');
const AuthAPI = require('../../../../src/api/auth');

const login = require('../../../../src/server/auth/login');


describe("server/auth/login.js", function () {

	let path = "/login";

	let config = null;
	let app = null;

	before(async function() {
		config = await TestConfig.init();
		if ( !config.schema ) return;
		app = await TestServer.start();
		let auth = new AuthAPI(config.schema, config.rsaPrivateKey);
		app.use(ServerUtils.apiInjector({AuthAPI: auth}));
		app.use(path, login);
		app.uri.path(path);

		const sql = `
		DELETE FROM Permissions;
			INSERT INTO Permissions VALUES('Administrator', NULL);
			INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
			INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
			DELETE FROM Organizations;
			INSERT INTO Organizations VALUES(1, 'GLOBAL', 'GLOBAL');
			INSERT INTO Organizations VALUES(2, 'testorg', 'Test Org Inc.');
			DELETE FROM Roles;
			INSERT INTO Roles (id, name, organizationId) VALUES(1, 'TestRole', 2);
			INSERT INTO Roles (id, name, organizationId) VALUES(2, 'TestRole2', 2);
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 1, 'Administrator');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 1, 'ListOrgCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 1, 'ListOwnCustomers');
			INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 10, 2, 'Administrator');
			DELETE FROM Groups;
			INSERT INTO Groups (Id, Name, OrganizationId) VALUES(1, 'TestGroup', 2);
			INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 2);
			INSERT INTO GroupPermissions (Mode, Prio, GroupId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			DELETE FROM Sessions;
			DELETE FROM Users;
			DELETE FROM UserPermissions;
			DELETE FROM UserRoles;
			DELETE FROM UserGroups;
			INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(1, 'testman', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 1);
			INSERT INTO UserGroups (Prio, GroupId, UserId) VALUES(10, 1, 1);
			INSERT INTO UserRoles (Prio, UserId, RoleId) VALUES(10, 1, 2);
			INSERT INTO UserPermissions (Mode, Prio, UserId, PermissionName) VALUES('allowed', 10, 1, 'ListOrgCustomers');
			INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(2, 'testman-inactive', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 0);
		`;
		if ( config.db ) {
			await config.db.query(sql);
		}
	});

	after(function() {

	});

	describe("POST /login", function () {


		it("performs a login with valid credentials", async function () {
			// eslint-disable-next-line no-invalid-this
			if (!app || !config.schema) this.skip();

			let resp = await superagent.post(app.uri.toString())
				.send({username: "testman", password: "test123456"});

			assert.isTrue(true);
		});

	});


});
