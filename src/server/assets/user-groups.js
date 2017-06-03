const express = require('express');

const BaseRelationRouter = require('./base-relation');
const Router = require('@datenwelt/cargo-api').Router;
const Schema = require('../../schema');

const UserModel = require('../../schema/user');

class UserGroupsRouter extends BaseRelationRouter {

	constructor(serverName, options) {
		super(serverName, 'UserGroup', options);
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

module.exports = UserGroupsRouter;
