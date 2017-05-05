/* eslint-disable class-methods-use-this,no-unused-vars,no-process-exit,func-style */
// eslint-disable-next-line id-length
const _ = require('underscore');
const ms = require('ms');
const VError = require('verror');

class Daemon {

	constructor(name, options) {
		options = Object.assign({
			dieOnInitFail: false,
			shutdownGracePeriod: '10s',
			logger: console
		}, options || {});
		if (!name) {
			throw new VError('Missing param #1 (name) in constructor call.');
		}
		this.name = name;
		Object.assign(this, options);
	}

	clone() {
		const options = _.pick(this, 'dieOnInitFail', 'shutdownGracePeriod', 'logger', 'trace');
		options.isClone = true;
		return new Daemon(this.name, options);
	}

	async run() {
		try {
			if (!this.isClone) {
				this.config = await this.init();
			}
		} catch (err) {
			throw new VError(err, 'Init process failed for server [%s]', this.name);
		}

		this.handleSigint = function () {
			let log_info = this.logger.info.bind(this.logger) || this.logger.log;
			let log_error = this.logger.error.bind(this.logger) || this.logger.log;
			let log_debug = this.logger.debug.bind(this.logger) || this.logger.log;

			process.removeListener('SIGINT', this.handleSigint);
			process.removeListener('SIGHUP', this.handleSighup);

			log_info('Shutting down server [%s].', this.name);
			let graceTimeout = setTimeout(function () {
				log_info('Shutdown of server [%s] did not finish within grace period (%s). Terminating.', this.name, this.shutdownGracePeriod);
				process.exit(0);
			}.bind(this), ms(this.shutdownGracePeriod));
			this.shutdown().then(function () {
				clearTimeout(graceTimeout);
				process.exit(0);
			}).catch(function (err) {
				log_error('Shutdown failed. Terminating: ' + err.message);
				log_debug(VError.fullStack(err));
				process.exit(1);
			});
		}.bind(this);

		this.handleSighup = function () {
			const log_info = this.logger.info.bind(this.logger) || this.logger.log;
			const log_error = this.logger.error.bind(this.logger) || this.logger.log;
			const log_warn = this.logger.warn.bind(this.logger) || this.logger.log;
			const log_debug = this.logger.debug.bind(this.logger) || this.logger.log;

			process.removeListener('SIGINT', this.handleSigint);
			process.removeListener('SIGHUP', this.handleSighup);

			const newInstance = this.clone();
			const startServer = function () {
				log_info('Starting server [%s] on reload event', this.name);
				newInstance.run().then(function () {
					log_info('Reload of server [%s] completed successfully.', this.name);
				}.bind(this)).catch(function (err) {
					log_error('Reload of server [%s] failed: ' + err.message, this.name);
					log_debug(VError.fullStack(err));
				}.bind(this));
			}.bind(this);

			const shutdownServer = function () {
				log_info('Shutting down server [%s] on reload event.', this.name);
				let graceTimeout = setTimeout(function () {
					log_warn('Shutdown of server [%s] did not finish within grace period (%s).', this.name, this.shutdownGracePeriod);
					if (this.dieOnInitFail) {
						process.exit(1);
						return;
					}
					startServer();
				}.bind(this), ms(this.shutdownGracePeriod));
				this.shutdown().then(function () {
					clearTimeout(graceTimeout);
					startServer();
				}).catch(function (err) {
					clearTimeout(graceTimeout);
					log_error('Server shutdown failed: ' + err.message);
					log_debug(VError.fullStack(err));
					if (this.dieOnInitFail) {
						process.exit(1);
					} else {
						startServer();
					}
				}.bind(this));
			}.bind(this);

			log_info('Reload of server [%s].', this.name);
			newInstance.init().then(function (config) {
				newInstance.config = config;
				shutdownServer();
			}).catch(function (err) {
				log_error('Unable to initialitze new instance for server [%s]: ' + err.message, this.name);
				if (this.dieOnInitFail) {
					log_error('Terminatig.');
					process.exit(1);
				} else {
					shutdownServer();
				}
			}.bind(this));
		}.bind(this);

		process.on('SIGINT', this.handleSigint);
		process.on('SIGHUP', this.handleSighup);

		await this.startup();
	}

	async init() {
	}

	async startup() {
	}

	async shutdown() {
	}

	async reload() {
		await
			this.handleSighup();
	}

}

module.exports = Daemon;
