const bunyan = require('bunyan');
const crypto = require('crypto');
const Promise = require('bluebird');
const VError = require('verror');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const Config = require('./config');
const Daemon = require('./daemon');

class CargoHttpServer extends Daemon {

	constructor(name, configFile, options) {
		super(name, options);
		if (!configFile) {
			throw new VError('Missing parameter #2 (configFile) in constructor call.');
		}
		this.configFile = configFile;
		this.routers = [];
	}

	clone() {
		return new CargoHttpServer(this.name, this.options);
	}

	async init() {
		const config = await Config.load(this.configFile);

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
					if ( !route ) {
						throw new VError('Missing "path" in configuration for route #%s', routeIndex);
					}
					if ( !moduleSrc ) {
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
					this.app.use(route, await router.init(config));
					this.routers.push(router);
				} catch (err) {
					throw new VError(err, '[%s] Unable to initialize router for route "%s" from module "%s". Skipping this route.', this.name, route, moduleSrc);
				}
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
			try {
				let logfile = config.server.access_log;
				this.app.use(CargoHttpServer.createAccessLog(logfile));
			} catch (err) {
				throw new VError(err, "[%s] Unable to initialize access.log at %s", this.name, logfile);
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
			app.listen(port, addr, function () {
				this.log_info('[%s] Server listening on %s:%d', this.name, addr, port);
				app.removeListener('error', errorListener);
				resolve();
			}.bind(this));

		}.bind(this));
	}

	async shutdown() {
		if (this.routers) {
			for (let router of this.routers) {
				// eslint-disable-next-line no-await-in-loop
				await router.shutdown();
			}
		}
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
