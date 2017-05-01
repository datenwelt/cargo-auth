// eslint-disable-next-line id-length
const _ = require('underscore');
const crypto = require('crypto');

const Model = require('../model');
const Schema = require('../schema');

let instance = null;

class Permission extends Model {

	constructor(schema) {
		super('io.cargohub.permission');
		this.schema = schema;
	}

	static async get() {
		if (instance) return instance;
		let schema = await Schema.get();
		instance = new Permission(schema);
		return instance;
	}

	async updateBitmap() {
		const rows = await this.schema.model('Permission').findAll({attributes: ['Name']});
		const permissions = _.pluck(rows, 'Name').sort().join();
		const hash = crypto.createHash('SHA1');
		hash.update(permissions);
		hash.update(String(Math.random()));
		const version = hash.digest('base64').substr(0, 8);
		const bitmap = await this.schema.model('PermissionBitmap').create({
			Version: version,
			Permissions: permissions,
			CreatedAt: new Date()
		});
		return bitmap.get();
	}

}

module.exports = Permission;
