/* eslint-disable no-console,no-process-env,no-process-exit */
const bluebird = require('bluebird');
const Promise = bluebird;
const bodyParser = require('body-parser');
const bunyan = require('bunyan');
const express = require('express');
const fs = bluebird.promisifyAll(require('fs'));
const NodeRSA = require('node-rsa');
const toml = require('toml');
const VError = require('verror').VError;

const AuthAPI = require('./api/auth');
const AuthLoginRouter = require('./server/auth/login');
const Daemon = require('./utils/daemon');
const PEMReader = require('./utils/pemreader');
const Schema = require('./schema');
const ServerUtils = require('./utils/server-utils');


// Debug setting from ENV. If true, errors come with stack traces.
let debug = process.env.CARGO_AUTH_DEBUG || false;
if (!debug || debug === 'false' || debug === '0') {
	debug = false;
} else {
	debug = true;
}

class AuthServer extends Daemon {

	constructor() {
		super(process.env.CARGO_AUTH_NAME || 'io.cargohub.authority');
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

		// API setup.
		config.api = {};
		config.api.AuthAPI = new AuthAPI(this.name, config.schema, config.rsaPrivateKey);
		if (config.logs && config.logs.logfile) {
			config.appLogger = bunyan.createLogger({
				name: this.name,
				streams: [
					{
						level: config.logs.level || "INFO",
						path: config.logs.logfile
					}
				]
			});
			for (let key of Object.keys(config.api)) {
				let api = config.api[key];
				api.onAny(this.onApiEvent.bind(this));
			}
		}

		// Network settings.
		let port = Number.parseInt(config.listen.port || 80, 10);
		if (Number.isNaN(port) || port <= 0) {
			throw new VError('Invalid value for "listen.port": %s', config.listen.port);
		}
		config.listen.port = port;
		config.listen.address = config.listen.address || "127.0.0.1";
		this.logger = bunyan.createLogger({name: this.name});
		return config;
	}

	startup() {
		return new Promise(function (resolve, reject) {
			const app = express();
			app.use(ServerUtils.apiInjector(this.config.api));
			app.use('/auth/login', AuthLoginRouter);
			if ( this.config.logs && this.config.logs.access_log ) {
				try {
					app.use(ServerUtils.accessLog(this.config.logs.access_log));
				} catch (err) {
					return reject(new VError(err, "Unable to initialize access.log at %s", this.config.logs.access_log));
				}
			}
			if ( this.config.logs && this.config.logs.error_log ) {
				try {
					app.use(ServerUtils.errorLog(this.config.logs.error_log));
				} catch (err) {
					return reject(new VError(err, "Unable to initialize error.log at %s", this.config.logs.error_log));
				}
			}
			app.use(bodyParser.json());
			this.config.app = app;
			const port = this.config.listen.port;
			const addr = this.config.listen.address;
			let errorListener = app.on('error', function (err) {
				app.removeListener('error', errorListener);
				reject(new VError(err, "Error listening on %s:%s", addr, port));
			});
			app.listen(port, addr, function () {
				app.removeListener('error', errorListener);
				resolve();
			});
		}.bind(this));
	}

	shutdown() {
		return new Promise(function (resolve) {
			for (let key of Object.keys(this.config.api)) {
				let api = this.config.api[key];
				api.removeAllListeners();
			}
			try {
				this.config.schema.close();
			} catch (err) {
			}
			try {
				this.config.app.server.close();
			} catch (err) {
			}
			resolve();
		}.bind(this));
	}

	onApiEvent(event, ...args) {
		if (event !== 'error') {
			this.config.appLogger.info(event, ...args);
		} else {
			this.config.appLogger.error(...args);
			if ( args.length && args[0] instanceof Error ) {
				this.config.appLogger.trace(VError.fullStack(args[0]));
			}
		}
	}

}

new AuthServer().run().catch(function (err) {
	console.error(err.message);
	if (debug) console.error(VError.fullStack(err));
	process.exit(1);
});

// database + api setup (DONE)

// signature checking middleware (?)

// cors header middleware

// access + error Log (DONE)

// application log (via api events) (DONE)

// connection to mq

// server routing (DONE)

// server startup, error handling (DONE)

// server reload / restart / exit (SIGHUP, SIGTERM etc.) (DONE)


