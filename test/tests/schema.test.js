const assert = require('chai').assert;

const Schema = require('../../src/schema');
const it = require("mocha").it;
const before = require("mocha").before;
const describe = require("mocha").describe;

const utils = require('./utils/schema');

describe('schema.js', function() {

	let dontSkip = null;
	before(async function() {
		dontSkip = await utils.schema();
	});

	describe('Schema.init()', function() {

		it("defines the schema", async function() {
			// eslint-disable-next-line no-invalid-this
			if ( !dontSkip ) return this.skip();
			const schema = await Schema.init();
			assert.instanceOf(schema, Schema);
			assert.isDefined(schema.uri);
			assert.isDefined(schema.sequelize);
			return true;
		});
	});

});

