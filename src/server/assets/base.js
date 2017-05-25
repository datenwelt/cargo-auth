const VError = require('verror');

const Schema = require('../../schema');
const Router = require('@datenwelt/cargo-api').Router;

class AssetsBaseRouter extends Router {

	constructor(serverName, api) {
		super();
		this.serverName = serverName;
		this.api = api;
	}

	async init(config, state) {
		state = state || {};
		await super.init(config, state);
		if (!this.api) throw new VError('AssetsAPI not initialized.');
		if (!state.schema) state.schema = await new Schema().init(config.db);
		this.schema = state.schema;
	}

}

module.exports = AssetsBaseRouter;
