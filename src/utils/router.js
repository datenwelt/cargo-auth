/* eslint-disable class-methods-use-this */
class Router {

	route(router) {
		return function (req, res, next) {
			const result = router(req, res, next);
			if (result.then && result.catch) {
				return result.catch(next);
			}
			return result;
		};
	}

}

module.exports = Router;
