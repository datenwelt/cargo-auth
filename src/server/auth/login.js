const express = require('express');
const VError = require('verror');

const handle = require('../../utils/api').asyncHandler;

const UserAPI = require('../../api/user').get();

// eslint-disable-next-line new-cap
const router = express.Router();

router.post("/", handle(async function (req, res) {
	const body = req.body;
	try {
		const session = await UserAPI.login(body.username, body.password);
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
	}
}));

module.exports = router;
