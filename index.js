/**
 * mongoose-plugins - main file
 */

var crud = require('./lib/modules/crud');
var auth = require('./lib/modules/auth');

exports.crudHelpers = crud.crudHelpers;
exports.installUserSchema = auth.installUserSchema;
