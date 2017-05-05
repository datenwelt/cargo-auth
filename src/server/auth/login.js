/* eslint-disable callback-return */
const express = require('express');
const VError = require('verror');

const handle = require('../../utils/server-utils').asyncHandler;

// eslint-disable-next-line new-cap
const router = express.Router();

router.post("/", handle(async function (req, res, next) {
	const body = req.body;
	if ( !req.api || !req.api.AuthAPI ) {
		throw new VError('Router for /login has no access to API.');
	}
	const AuthAPI = req.api.AuthAPI;
	try {
		const session = await AuthAPI.login(body.username, body.password);
		return res.send(200, session);
	} catch (err) {
		if ( err.name === 'CargoModelError' ) {
			res.set('X-cargo-error', err.code);
			switch (err.code) {
				case 'ERR_USERNAME_INVALID':
				case 'ERR_PASSWORD_INVALID':
				case 'ERR_USERNAME_MISSING':
				case 'ERR_PASSWORD_MISSING':
					return res.sendStatus(400);
				case 'ERR_UNKNOWN_USER':
					return res.sendStatus(400);
				case 'ERR_LOGIN_SUSPENDED':
					return res.sendStatus(503);
				case 'ERR_LOGIN_FAILED':
					return res.sendStatus(403);
				default:
					return res.sendStatus(500);
			}
		} else {
			throw new VError(err, 'Unable to perform login for user "%s"', body.username);
		}
	} finally {
		next();
	}
}));

router.all('/', function(req, res, next) {
	if ( !res.headersSent)
		res.sendStatus(405);
	next();
});

module.exports = router;
