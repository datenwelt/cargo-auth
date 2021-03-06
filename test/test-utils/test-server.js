/* eslint-disable no-console */
const assert = require('chai').assert;
const bodyParser = require('body-parser');
const express = require('express');
const Promise = require('bluebird');
const URI = require('urijs');

module.exports = {

	start: function () {
		return new Promise(function (resolve, reject) {
			const app = express();
			app.on('error', function (err) {
				app.removeAllListeners('error');
				app.removeAllListeners('listening');
				reject(err);
			});
			app.listen(function () {
				// eslint-disable-next-line no-invalid-this
				app.server = this;
				let uri = new URI('http://127.0.0.1/');
				uri.port(app.server.address().port);
				app.uri = uri;
				app.removeAllListeners('error');
				app.removeAllListeners('listening');
				resolve(app);
			});
			app.use(bodyParser.json());
		});

	},

	createErrorHandler: function () {
		// eslint-disable-next-line no-unused-vars,max-params
		return function (err, req, res, next) {
			if (err.name === 'HttpError') {
				res.status(err.code).set('X-Error', err.message);
			} else {
				res.status(500);
				console.log(err);
			}
			if (!res.headersSent) res.end();
		};
	},

	expectErrorResponse: async function(code, error, xhrPromise) {
		try {
			await xhrPromise;
		} catch (err) {
			assert.property(err, 'response');
			const response = err.response;
			assert.equal(response.status, code, "Unexpected status code");
			assert.equal(response.header['x-error'], error, "Unexpected error header");
			return;
		}
		throw new Error('XMLHttpRequest was successful but should have failed.');
	}

};

