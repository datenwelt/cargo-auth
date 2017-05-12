/* eslint-disable id-length */
const _ = require('underscore');
const bluebird = require('bluebird');
const bunyan = require('bunyan');
const crypto = require('crypto');
const fs = bluebird.promisifyAll(require('fs'));
const moment = require('moment');
const os = require('os');
const Promise = require('bluebird');
const VError = require('verror');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const Config = require('./config');
const Daemon = require('./daemon');
const MQ = require('./mq');

class CargoHttpServer extends Daemon {

	constructor(name, configFile, options) {
		super(name, options);
		if (!configFile) {
			throw new VError('Missing parameter #2 (configFile) in constructor call.');
		}
		this.configFile = configFile;
		this.routers = [];
		this.mq = null;
		this.appLogger = null;
	}

	clone() {
		return new CargoHttpServer(this.name, this.configFile, this.options);
	}

	async init() {
		const config = await Config.load(this.configFile);
		const state = {};

		let port = Number.parseInt(config.server.port || 80, 10);
		if (Number.isNaN(port) || port <= 0) {
			throw new VError('Invalid value for "server.port": %s', config.server.port);
		}
		this.listen = {port: port, address: config.server.address || "127.0.0.1"};

		this.app = express();

		this.app.use(function (req, res, next) {
			const md5 = crypto.createHash('MD5');
			md5.update(Math.random().toString(10));
			req.id = md5.digest('hex').substr(0, 8).toUpperCase();
			next();
		});


		this.app.use(bodyParser.json());
		this.app.use(cors());
		this.app.options('*', cors());

		if (config.server.routes) {
			for (let routeIndex of Object.keys(config.server.routes).sort()) {
				let routeConfig = config.server.routes[routeIndex];
				let route = routeConfig.path;
				let moduleSrc = routeConfig.module;
				try {
					if (!route) {
						throw new VError('Missing "path" in configuration for route #%s', routeIndex);
					}
					if (!moduleSrc) {
						throw new VError('Missing "module" in configuration for route #%s', moduleSrc);
					}
					if (!path.isAbsolute(moduleSrc)) {
						moduleSrc = path.join(process.cwd(), moduleSrc);
						moduleSrc = path.normalize(moduleSrc);
					}
					this.log_info('[%s] Initializing router for route "%s" from "%s".', this.name, route, moduleSrc);
					// eslint-disable-next-line global-require
					let Router = require(moduleSrc);
					let router = new Router(this.name);
					// eslint-disable-next-line no-await-in-loop
					this.app.use(route, await router.init(config, state));
					this.routers.push(router);
				} catch (err) {
					this.log_error(err, '[%s] Unable to initialize router for route "%s" from module "%s". Skipping this route.', this.name, route, moduleSrc);
				}
			}
		}
		if (config.server && config.server.fail_without_routes) {
			if (!this.routers || !this.routers.length) {
				throw new VError('[%s] Server has no routes. Use config setting "server.fail_without_routes=false" to start anyways.', this.name);
			}
		}

		this.app.all('*', function (req, res, next) {
				if (!res.headersSent)
					res.sendStatus(404);
				next();
			}
		);

		if (config.server && config.server.error_log) {
			let logfile = config.server.error_log;
			try {
				this.app.use(CargoHttpServer.createErrorLog(logfile));
			} catch (err) {
				throw new VError(err, "[%s] Unable to initialize error.log at %s", this.name, logfile);
			}
		}

		// General error handler.
		// eslint-disable-next-line handle-callback-err,max-params
		this.app.use(function (err, req, res, next) {
			res.sendStatus(500);
			next();
		});

		if (config.server && config.server.access_log) {
			let logfile = config.server.access_log;
			try {
				this.app.use(CargoHttpServer.createAccessLog(logfile));
			} catch (err) {
				throw new VError(err, "[%s] Unable to initialize access.log at %s", this.name, logfile);
			}
		}

		// Application log
		if (config.logs && config.logs.logfile) {
			const logfile = config.logs.logfile;
			const level = config.logs.level || 'INFO';
			try {
				this.appLogger = bunyan.createLogger({
					name: this.name,
					streams: [{path: logfile, type: 'file'}],
					level: level
				});
				for (let api of _.values(state.apis)) {
					api.logger = this.appLogger;
					api.onAny(function (event, ...args) {
						if (event === 'error') {
							this.appLogger.error(...args);
							if (args[0] && args[0] instanceof Error) {
								this.appLogger.debug(args[0]);
							}
						} else {
							this.appLogger.info(...args);
						}
					}.bind(this));
				}
			} catch (err) {
				throw new VError(err, "[%s] Unable to initialize application log at %s", this.name, logfile);
			}
		}

		// Message Queue for API events.
		if (config.mq && state.apis && _.keys(state.apis).length) {
			try {
				this.mq = await new MQ().init(config.mq);
			} catch (err) {
				throw new VError(err, "[%s] Unable to connect to message queue at %s", this.name, config.uri);
			}
			for (let api of _.values(state.apis)) {
				api.onAny(async function (event, data) {
					if (event !== 'error') {
						let channel = null;
						try {
							channel = await this.mq.connectChannel();
						} catch (err) {
							this.log_error(err, '[%s] Unable to connect to message queue at %s', this.name, this.mq.uri);
							this.log_info('Shutting down after fatal error.');
							await this.shutdown();
							// eslint-disable-next-line no-process-exit
							process.exit(1);
							return;
						}
						try {
							// eslint-disable-next-line no-undefined
							const json = JSON.stringify(data || {}, undefined, ' ');
							const content = Buffer.from(json, 'utf8');
							channel.publish(this.mq.exchange, event, content, {
								persistent: true,
								contentType: 'application/json',
								timestamp: moment().unix(),
								appId: this.name + '@' + os.hostname()
							});
						} catch (err) {
							this.log_error(err, "[%s] Unable publish API event '%s' to message qeue: %s", this.name, event, err.message);
						}
					}
				}.bind(this));
			}
		}
		return config;
	}

	startup() {
		return new Promise(function (resolve, reject) {
			const app = this.app;
			const port = this.listen.port;
			const addr = this.listen.address;
			let errorListener = app.on('error', function (err) {
				app.removeListener('error', errorListener);
				reject(new VError(err, "Error listening on %s:%s", addr, port));
			});
			// eslint-disable-next-line consistent-this
			const self = this;
			let listenReady = function (server) {
				app.server = server;
				this.log_info('[%s] Server listening on %s:%d', self.name, addr, port);
				app.removeListener('error', errorListener);
			}.bind(this);
			app.listen(port, addr, function () {
				// eslint-disable-next-line no-invalid-this
				listenReady(this);
				resolve();
			});

		}.bind(this));
	}

	shutdown() {
		return new Promise(function (resolve) {
			if (this.app && this.app.server) {
				this.app.server.close(async function () {
					if (this.routers) {
						for (let router of this.routers) {
							// eslint-disable-next-line no-await-in-loop
							await router.shutdown();
						}
					}
				}.bind(this));
			}
			if (this.mq) this.mq.close();
			resolve();
		}.bind(this));
	}

	static createAccessLog(logfile) {
		const logger = bunyan.createLogger({
			name: "access",
			streams: [{level: 'INFO', path: logfile}]
		});
		return function (req, res, next) {
			const logContent = {};
			logContent.client = req.ip;
			logContent.requestId = req.id;
			logContent.username = req.username || '-';
			logContent.date = req.get('Date');
			logContent.method = req.method;
			logContent.url = req.originalUrl;
			logContent.status = res.statusCode;
			logger.info(logContent);
			next();
		};

	}

	static createErrorLog(logfile) {
		const logger = bunyan.createLogger({
			name: "error",
			streams: [{level: 'DEBUG', path: logfile}]
		});
		// eslint-disable-next-line max-params
		return function (err, req, res, next) {
			logger.error({requestId: req.id, err: err});
			next(err);
		};
	}

}

module.exports = CargoHttpServer;
