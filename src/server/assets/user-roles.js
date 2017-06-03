const BaseRelationRouter = require('./base-relation');

class UserRolesRouter extends BaseRelationRouter {

	constructor(serverName, options) {
		super(serverName, 'UserRole', options);
		options = Object.assign({schema: null}, options);
		this.schema = options.schema;
	}

	async init(config, state) {
		await super.init(config, state);
		await this.installGetRouter();
		await this.installPostRouter();
		await this.installDeleteRouter();
		return this.app;
	}

}

module.exports = UserRolesRouter;
