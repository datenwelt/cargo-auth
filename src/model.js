const EventEmitter = require('events').EventEmitter;
const VError = require('verror');

class Model extends EventEmitter {

	constructor(name, schema) {
		super();
		this.name = name;
		this.schema = schema;
	}

	error(err, cause) {
		if (err instanceof VError && err.name === "CARGO_MODEL_ERROR") {
			err.cause = cause;
			err.model = this.name;
		} else if (err instanceof Error) {
			err = Model.createError("UNKNOWN_ERROR_CODE", err, this.name);
		} else {
			err = Model.createError("UNKNOWN_ERROR_CODE", new Error(err), this.name);
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


module.exports = Model;
