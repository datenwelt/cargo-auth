/* eslint-disable no-invalid-this */
const describe = require("mocha").describe;
const it = require("mocha").it;
const assert = require("chai").assert;
const before = require("mocha").before;

const SchemaUtils = require('../../test-utils/schema');


describe("model/user.js", function () {

	let schema = null;
	let db = null;

	before(async function () {
		try {
			schema = await SchemaUtils.schema();
			if (!schema) return;
		} catch (err) {
			schema = null;
		}
		try {
			db = await SchemaUtils.db();
		} catch (err) {
			db = null;
		}
	});

});
