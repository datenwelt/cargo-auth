let master = {
	db: null,
	schema: null,
	rsaPrivateKey: null,
	rsaPublicKey: null,
};

let instance = null;

class Config {

	constructor() {
		this.db = master.db;
		this.schema = master.schema;
		this.rsaPrivateKey = master.rsaPrivateKey;
		this.rsaPublicKey = master.rsaPublicKey;
	}

	static setup(options) {
		master = Object.assign(master, options);
	}

	static get() {
		if ( !instance ) {
			instance = new Config();
		}
		return instance;
	}

}

module.exports = Config;
