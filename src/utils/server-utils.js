const bunyan = require('bunyan');
const crypto = require('crypto');

module.exports = {

	asyncHandler: function (fn) {
		return function (req, res, next) {
			const result = fn(req, res, next);
			if (result.then && result.catch) {
				return result.catch(next);
			}
			return result;
		};
	},

	apiInjector: function (api) {
		return function (req, res, next) {
			const md5 = crypto.createHash('MD5');
			md5.update(Math.random());
			req.id = md5.digest('hex').substr(0, 8).toUpperCase();
			req.api = api;
			next();
		};
	},

	accessLog: function (logfile) {
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
	},

	errorLog: function (logfile) {
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


};
