/**
 * mongoose-plugins - copyright(c) 2012 truepattern.
 * MIT Licensed
 */

//
// Auth helpers for mongoosejs.
//
// Wrapper for https://github.com/bnoguchi/mongoose-auth
// 

/** Todo's 
 * - add options to the plugin
 * - pass all the jade files and path to options
 */

// dependencies
var logger    = require('winston');

// set up module variables
var pkgname  = '[mongoose-plugins/auth] ';

// There are issues with using everyauth, mongooseAuth
// independent of the application, so an easy way is to
// get the references from app
exports.installUserSchema = function(mongoose, everyauth, mongooseAuth, options) {
  var Schema  = mongoose.Schema;
  var Promise = everyauth.Promise;

  // mongoose-auth related dependencies
  var mongooseTypes = require("mongoose-types"),
      useTimestamps = mongooseTypes.useTimestamps,
      aonx = require('./crud');

  mongooseTypes.loadTypes(mongoose);
  var Email = mongoose.SchemaTypes.Email;

  // set the options
  everyauth.debug = (options && options.debug) ? options.debug : true;
  var defaultRole = (options && options.role) ? options.role : 'User';
  var isActiveByDefault = (options && options.active) ? options.active : true;

  logger.debug(pkgname + 'installing user schema with role:'+
               defaultRole + ',active:' + isActiveByDefault);

  /**
   * Lets define the user schema here
   */
  var UserSchema = new Schema({
    active : { type: Boolean, default:isActiveByDefault},
    role   : { type: String,  default:defaultRole }
  }), User;

  UserSchema.plugin(useTimestamps);
  UserSchema.plugin(aonx.crudHelpers);
  UserSchema.plugin(mongooseAuth, {
    // Here, we attach the User model to every module
    everymodule: {
      everyauth: {
        User: function () {
          return User;
        }
      }
    },

    // simple registration (app)
    password: {
      loginWith: 'email',
      extraParams: {
        phone  : String,
        lastname: String,
        firstname: String
      },
      everyauth: {
        getLoginPath        : '/login',
        postLoginPath       : '/login',
        loginView           : 'login.jade',
        getRegisterPath     : '/register',
        postRegisterPath    : '/register',
        registerView        : 'register.jade',
        loginSuccessRedirect: '/',
        registerSuccessRedirect: '/',

        // implementation in lib/modules/password/everyauth.js
        authenticate: function (login, password) {
          logger.info(pkgname+'authenticating '+login);
          var promise, errors = []; 
          if (!login) errors.push('Missing login.');
          if (!password) errors.push('Missing password.');
          if (errors.length) return errors;
          
          promise = this.Promise();
          this.User()().authenticate(login, password, function (err, user) {
            if (err) {
              errors.push(err.message || err);
              return promise.fulfill(errors);
            }   
            if (!user) {
              errors.push('Failed login.');
              return promise.fulfill(errors);
            }
            // The following block is the new code
            if (!user.active) {
              errors.push('You are not yet activated.');
              return promise.fulfill(errors);
            }
            promise.fulfill(user);
          });
          return promise;
        }
      }
    }
  });

  /* Now define the model into mongoose */
  logger.debug(pkgname + 'registering UserSchema with mongoose');
  mongoose.model('User', UserSchema);
  User=mongoose.model('User');
  return User;
};
