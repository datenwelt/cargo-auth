const EventEmitter = require('eventemitter2').EventEmitter2;
const VError = require('verror');

class API extends EventEmitter {

	constructor(name) {
		super({wildcard: true, delimiter: '.', newListener: false,});
		this.name = name;
	}

	error(err, cause) {
		if (err instanceof VError && err.name === "CargoModelError") {
			err.cause = cause;
			err.model = this.name;
		} else if (err instanceof Error) {
			err = API.createError("UNKNOWN_ERROR_CODE", err, this.name);
		} else {
			err = API.createError(err, new Error(err), this.name);
		}
		this.emit('error', err);
		return err;
	}

	static createError(code, cause, model) {
		const error = new VError({
			name: "CargoModelError",
			cause: cause
		}, "CargoModelError: %s", code);
		error.code = code;
		error.model = model;
		return error;
	}
}

module.exports = API;