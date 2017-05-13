/* eslint-disable no-process-env,no-process-exit,no-console */
const bunyan = require('bunyan');
const fs = require('fs');
const Server = require('./utils/server');
const VError = require('verror');

// Debug setting from ENV. If true, errors come with stack traces.
let debug = process.env.CARGO_AUTH_DEBUG || false;
debug = !(!debug || debug === 'false' || debug === '0');


const locations = [process.env.CARGO_AUTH_CONFIG, '~/.cargo/authd.conf', '/etc/cargo/authd.conf'];
let configFile = null;
for (configFile of locations) {
	if (!configFile) continue;
	// eslint-disable-next-line no-sync
	let stats = fs.statSync(configFile);
	if (!stats || !stats.isFile()) {
		continue;
	}
	try {
		// eslint-disable-next-line no-sync
		fs.accessSync(configFile, 'r');
	} catch (err) {
		continue;
	}
	break;
}

const serverName = process.env.CARGO_AUTH_APPNAME || 'io.cargohub.authd';
const logger = bunyan.createLogger({
	name: serverName,
	level: debug ? 'DEBUG' : 'INFO'
});

new Server(serverName, configFile, { /*logger: logger*/ }).run().catch(function (err) {
	console.error(err.message);
	if (debug) console.error(VError.fullStack(err));
	console.error('Exiting.');
	process.exit(1);
});
