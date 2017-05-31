const AssetsRouter = require('./base');

class GroupsRouter extends AssetsRouter {

	constructor(serverName, options) {
		super(serverName, 'Group', options);
	}

	async init(config, state = {}) {
		await super.init(config, state);
		await this.installGetRouter({offset: 0, limit: 100});
		await this.installPostRouter();
		await this.installGetItemRouter();
		await this.installPostItemRouter();
		await this.installPutItemRouter();
		await this.installDeleteItemRouter();
		return this.app;
	}
}

module.exports = GroupsRouter;
