const check = require('../../utils/check');
const express = require('express');
const VError = require('verror');

const handle = require('../../utils/api').asyncHandler;

const UserModel = require('../../model/user').get();

// eslint-disable-next-line new-cap
const router = express.Router();

router.post("/", handle(async function (req, res) {
	const body = req.body;
	let username = null;
	let password = null;
	try {
		username = check(body.username).trim('ERR_USERNAME_INVALID')
			.not().isBlank('ERR_USERNAME_MISSING')
			.val();
		password = check(body.password).trim('ERR_PASSWORD_INVALID')
			.not().isBlank('ERR_PASSWORD_MISSING')
			.val();
	} catch (err) {
		return res.set('X-cargo-error', err).sendStatus(400);
	}
	try {
		const session = await UserModel.login(username, password);
		return res.send(200, session);
	} catch (err) {
		if ( err.name === 'CargoModelError' ) {
			res.set('X-cargo-error', err.code);
			switch (err.code) {
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
			throw new VError(err, 'Unable to perform login for user "%s"', username);
		}
	}
}));

module.exports = router;
