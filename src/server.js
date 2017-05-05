/* eslint-disable no-console,no-process-env,no-process-exit */
const bluebird = require('bluebird');
const bunyan = require('bunyan');
const fs = bluebird.promisifyAll(require('fs'));
const NodeRSA = require('node-rsa');
const toml = require('toml');
const VError = require('verror').VError;

const Daemon = require('./utils/daemon');
const PEMReader = require('./utils/pemreader');
const Schema = require('./schema');


// Debug setting from ENV. If true, errors come with stack traces.
let debug = process.env.CARGO_AUTH_DEBUG || false;
if (!debug || debug === 'false' || debug === '0') {
	debug = false;
} else {
	debug = true;
}

class AuthServer extends Daemon {

	constructor() {
		super('cargo-authd');
	}

	async init() {
		// Read an parse file.
		let configFile = process.env.CARGO_AUTH_CONFIG || '/etc/cargo/auth.conf';
		let configContent = await fs.readFileAsync(configFile, 'utf8');
		let config = toml.parse(configContent);

		// Database setting.
		if (!config.db) throw new VError('Database URI needed to start server. Use config option "db" e.g. "db=mysql://user:pass@host/database"');
		try {
			config.schema = await
			Schema.init(config.db);
		} catch (err) {
			throw new VError(err, "Unable to initialize database at %s", config.db);
		}

		// RSA settings.
		if (!config.rsa || !config.rsa.keyfile) throw new VError('Private RSA key needed to start server. Use config option "rsa.keyfile" to configure a private key.');
		let privateKeyData = await fs.readFileAsync(config.rsa.keyfile, 'utf8');
		try {
			config.rsaPrivateKey = PEMReader.readPrivateKey(privateKeyData, config.rsa.passphrase);
		} catch (err) {
			throw new VError(err, 'Unable to read private key from %s', config.rsa.keyfile);
		}
		try {
			let rsa = new NodeRSA(config.rsaPrivateKey);
			config.rsaPublicKey = rsa.exportKey('public');
		} catch (err) {
			throw new VError(err, 'Unable to derive RSA public from private key.');
		}

		// Network settings.
		let port = Number.parseInt(config.listen.port || 80, 10);
		if (Number.isNaN(port) || port <= 0) {
			throw new VError('Invalid value for "listen.port": %s', config.listen.port);
		}
		config.listen.port = port;
		config.listen = config.listen || "127.0.0.1";
		this.logger = bunyan.createLogger({ name: this.name });
		return config;
	}

	async startup() {
		setInterval(function() {
			console.log('Running');
		}, 1000);
	}
}

new AuthServer().run().catch(function(err) {
	console.error(err.message);
	if ( debug ) console.error(VError.fullStack(err));
	process.exit(1);
});


setTimeout(function() {
	process.kill(process.pid, 'SIGHUP');
}, 2000);

// database + api setup

// signature checking middleware (?)

// cors header middleware

// access + error Log

// application log (via api events)

// connection to mq

// server routing

// server startup, error handling

// server reload / restart / exit (SIGHUP, SIGTERM etc.)


