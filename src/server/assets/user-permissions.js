const BaseRelationRouter = require('./base-relation');

class UserPermissionsRouter extends BaseRelationRouter {

	constructor(serverName, options) {
		super(serverName, 'UserPermission', options);
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

module.exports = UserPermissionsRouter;
