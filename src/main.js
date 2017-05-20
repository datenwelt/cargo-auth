/* eslint-disable no-process-env,no-process-exit,no-console */
const Config = require('@datenwelt/cargo-api').Config;
const Logger = require('js-logger');
const moment = require('moment');
const Server = require('@datenwelt/cargo-api').Server;
const util = require('util');
const VError = require('verror');

moment.locale(process.env.CARGO_AUTH_LOCALE || "en");

// Debug setting from ENV. If true, errors come with stack traces.
let debug = process.env.CARGO_AUTH_DEBUG || false;
debug = !(!debug || debug === 'false' || debug === '0');


const locations = [process.env.CARGO_AUTH_CONFIG, '~/.cargo/authd.conf', '/etc/cargo/authd.conf'];
let configFile = Config.find(locations);

const serverName = process.env.CARGO_AUTH_APPNAME || 'io.cargohub.authd';

Logger.useDefaults({
	defaultLevel: debug ? Logger.DEBUG : Logger.INFO,
	formatter: function (messages) {
		if ( messages[0] && typeof messages[0] === 'string')
			messages[0] = util.format('[%s] [%s] ', moment().toString(), serverName) + messages[0];
	}
});

new Server(serverName, configFile, {logger: Logger}).run().catch(function (err) {
	console.error(err.message);
	if (debug) console.error(VError.fullStack(err));
	console.error('Exiting.');
	process.exit(1);
});
