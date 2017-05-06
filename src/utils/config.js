const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const toml = require('toml');

class Config {

	static async load(filename) {
		let configContent = await fs.readFileAsync(filename, 'utf8');
		return toml.parse(configContent);
	}

}

module.exports = Config;
