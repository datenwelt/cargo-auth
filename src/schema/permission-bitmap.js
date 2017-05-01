/* eslint-disable id-length */
const _ = require('underscore');
const crypto = require('crypto');
const Sequelize = require('sequelize');

module.exports = {
	define: function (schema) {
		return schema.define('PermissionBitmap', {
			Version: {
				field: 'version',
				// eslint-disable-next-line new-cap
				type: Sequelize.STRING(12),
				allowNull: false,
				primaryKey: true,
				comment: "Unique version string of the bitmap."
			},
			Permissions: {
				field: 'permissions',
				type: Sequelize.TEXT,
				comment: "A comma-seperated list of all known permission names."
			},
			CreatedAt: {
				type: Sequelize.DATE,
				comment: "Date and time when the bitmap has been introduced."
			}
		}, {
			classMethods: {
				// eslint-disable-next-line require-await
				findLatest: async function() {
					return this.sequelize.model('PermissionBitmap').findOne({
						order: [['CreatedAt', 'DESC']]
					});
				},
				createLatest: async function() {
					let permissions = await this.sequelize.model('Permission').findAll({attributes: ['Name']});
					permissions = _.pluck(permissions, 'Name').sort().join();
					let version = null;
					while ( !version ) {
						const hash = crypto.createHash('SHA1');
						hash.update(permissions);
						hash.update(String(Math.random()));
						version = hash.digest('base64').substr(0, 8);
						// eslint-disable-next-line no-await-in-loop
						let versionExists = await this.sequelize.model('PermissionBitmap').findOne({where: {Version: version }});
						if ( versionExists ) version = null;
					}
					return this.sequelize.model('PermissionBitmap').create({
						Version: version,
						Permissions: permissions,
						CreatedAt: new Date()
					});
				}
			},
			instanceMethods: {
				permissionsToBitmap: function(permissions) {
					let allPermissions = this.get('Permissions').split(',');
					let bitmap = 0x0;
					for (let permission of allPermissions) {
						// eslint-disable-next-line no-bitwise
						bitmap <<= 1;
						if (_.contains(permissions, permission)) {
							// eslint-disable-next-line no-bitwise
							bitmap |= 0x1;
						}
					}
					return bitmap;
				},
				bitmapToPermissions: function(bitmap) {
					let allPermissions = this.get('Permissions').split(',');
					if ( !allPermissions.length ) return [];
					let permissions = [];
					// eslint-disable-next-line no-bitwise
					let mask = 0x1 << allPermissions.length-1;
					for (let permission of allPermissions) {
						// eslint-disable-next-line no-bitwise
						let allowed = bitmap & mask;
						if ( allowed ) permissions.push(permission);
						// eslint-disable-next-line no-bitwise
						mask >>= 1;
					}
					return permissions.sort();
				}
			}
		});
	}
};
