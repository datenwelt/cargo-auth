
module.exports = {

	asyncHandler: function (fn) {
		return function (req, res, next) {
			const result = fn(req, res, next);
			if (result.then && result.catch) {
				return result.catch(next);
			}
			return result;
		};
	}

};
