const check = require('../../lib/check');
const crypto = require('crypto');
const express = require('express');
const handle = require('../../lib/api').asyncHandler;
const Schema = require('../../schema');
const VError = require('verror');

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
}));

module.exports = router;
