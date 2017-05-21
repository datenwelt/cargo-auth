
class CargoAuth {
}

CargoAuth.Schema = require('./src/schema');
CargoAuth.API = require('./src/api/auth');
CargoAuth.Router = require('./src/server/auth');

module.exports = CargoAuth;
