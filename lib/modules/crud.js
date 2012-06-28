/**
 * mongoose-plugins - copyright(c) 2012 truepattern.
 * MIT Licensed
 */

//
// CRUD helpers for mongoosejs.
//

/** Todo's 
- handle all error conditions
*/

// dependencies
var logger   = require('winston');
var _        = require('underscore');
var async    = require('async');
var mongoose = require('mongoose');

// ObjectId reference
var DocumentObjectId = mongoose.Types.ObjectId;

// set up module variables
var pkgname  = '[mongoose-plugins/crud] ';

// exported methods, variables
// @todo: 
//  -- Options - inline object / not
//  -- expand array
exports.crudHelpers = function(schema, options) {

  // json output to carry id instead of _id
  schema.methods.toJSON = function (options) {
    var o=this.toObject(); 
    o.id=o._id; 
    delete o._id; 

    // Lookup all the object references
    var refobjs = _.filter(_.keys(schema.paths), function(field) {
      return field.charAt(0)!='_' && schema.paths[field].instance=='ObjectID';
    });
    // lets make the objects inline
    _.each(refobjs, function(refobj) { 
      if(_.isObject(o[refobj])) {
        o=_.extend(o, o[refobj]); 
        delete o[refobj]; 
      }
    });
    // lets remove any _ prefix variables
    _.each(_.keys(o), function(k) { if(k.charAt(0)=='_') delete o[k]; });
    return o;
  };

  schema.statics.index = function(req,res) {
    var modelName = this.modelName.toLowerCase();
    logger.debug(pkgname + modelName + ' index called with req:'+JSON.stringify(req.query));
    var query={};
    _.extend(query,req.query);
    // lets update the query based on params passed
    // remove 'callback', '_method' & '_' (from jsonp)
    query=_.pick(query, _.without(_.keys(query),'callback', '_', '_method'));
    if(!_.isEqual(query,req.query)) {
      logger.debug(pkgname + modelName + ' modified request:'+JSON.stringify(query));
    }

    // Lets populate here all the object references
    var refobjs = _.filter(_.keys(schema.paths), function(field) {
      var path=schema.paths[field];
      return field!='_id' && path.instance=='ObjectID';
    });
    var q=this.find(query);
    _.each(refobjs, function(refobj) { q=q.populate(refobj); });
    q.exec(function(err, objs) {
      if(!err) {
        res.send(objs);
      }
    });
  };

  schema.statics.createObject = function(req, res) {
    var model = mongoose.model(this.modelName);
    var record = new model;
    var modelName = this.modelName.toLowerCase();
    logger.debug(pkgname + modelName + ' CREATE called');
    this.createOrUpdate(req, record, function(err, newObj) {
      if(!err) {
        res.json(newObj, 201);
      } else {
        res.send(406);
      }
    });
  };

  schema.statics.updateObject = function(record, req, res) {
    this.createOrUpdate(req, record, function(err, newObj) {
      if(!err) {
        res.json(newObj, 202);
      } else {
        res.send(406);
      }
    });
  };

  schema.statics.showObject = function(record, req, res) {
    var modelName = this.modelName.toLowerCase();
    logger.debug(pkgname + modelName + ' GET called with req:'+JSON.stringify(req.query));
    if(typeof record == 'undefined') {
      logger.error(pkgname + 'invalid record passed');
    } else {
      res.json(record);
    }
  };

  schema.statics.removeObject = function(record, req, res) {
    var modelName = this.modelName.toLowerCase();
    logger.debug(pkgname + modelName + ' DELETE called with req:'+JSON.stringify(req.query));
    if(typeof record == 'undefined') {
      logger.error(pkgname + 'invalid record passed');
    } else {
      logger.info(pkgname + '** removing:'+JSON.stringify(record));
      // Lookup all the object references
      var refobjs = _.filter(_.keys(schema.paths), function(field) {
        var path=schema.paths[field];
        return field!='_id' && path.instance=='ObjectID';
      });
      // remove all the reference as well
      // @todo: need to take care of atomicity
      async.forEachSeries(refobjs, function(refobj, next) {
        var r = record[refobj];
        logger.info(pkgname+'** removing reference object:'+r);
        r.remove(next);
      }, function(err) {
        if(err) {
          logg.error(pkgname+'Unable to remove object references :'+ err);
          res.send(500);
        } else {
          record.remove(function(err) { 
            if(err) {
              // @todo: need to send appropriate error code
              logger.error(pkgname+'Error occured while removing :'+err);
              res.send(500);
            } else {
              res.send(200);
            }
          });
        }
      });
    }
  };

  // callback - function(err, object)
  schema.statics.loadFullObject = function(id, callback) {
    var self = this;
    // Lookup all the object references
    var refobjs = _.filter(_.keys(schema.paths), function(field) {
      var path=schema.paths[field];
      return field!='_id' && path.instance=='ObjectID';
    });
    var query=self.findById(id);
    _.each(refobjs, function(refobj) { query=query.populate(refobj); });
    query.exec(callback);
  };

  schema.statics.findObject = function(id, cb) {
    var self = this;
    process.nextTick(function(){
      logger.debug(pkgname + 'find :'+id);
      self.loadFullObject(id, function(err, obj) {
        if(err || obj==null) {
          logger.info(pkgname + '  -- NOT found');
        } else {
          logger.debug(pkgname + '  -- found :'+JSON.stringify(obj));
        }
        cb(err, obj);
      });
    });
  };

  /**
   * Process parameters that are applicable to this record
   * and return back the unprocessed array of params
   */
  schema.statics.updateParams = function(params, record, cb) {
    // First step is to call
    // any ObjectId's that are define in the record
    var refobjs = _.filter(_.keys(schema.paths), function(field) {
      var path=schema.paths[field];
      return field!='_id' && path.instance=='ObjectID';
    });
    async.forEachSeries(refobjs, function(refobj, next) {
      var path = schema.paths[refobj];
      var model = mongoose.model(path.options.ref);
      var r = record[refobj] || new model;
      var modelParams = _.clone(params);
      model.updateParams(modelParams, r, function(err, modelParams, obj) {
        if(!_.isEqual(modelParams, params)) {
          // the object was updated, so lets save it
          obj.save(function(err) {
            if(err) {
              logger.error(pkgname+'Error occured while saving :'+err);
            } else {
              logger.debug(pkgname + '  - updating "'+refobj+
                           '" from "'+ record[refobj] + '" => "' + obj +'"');
              //@todo: Need to take care of
              // any transaction issues - if err
              record[refobj]=obj;
              params = modelParams;
            }
            next(err);
          });
        } else {
          next();
        }
      });
    }, function(err) {
      if(!err) {
        // pass thru the parameters to see 
        // if they can be processed
        for(var p in params) {
          //@todo: raise error if the val is invalid
          if(p && params[p]) {
            var val = params[p];
            // @todo: options.required to be checked
            // check if this parameter is an objectId
            if(schema.paths[p]) {
              if(schema.paths[p].instance=='ObjectId') {
                val = DocumentObjectId.fromString(val);
              }
              // navigate to the appropriate hashmap and insert
              var objMap = record;
              var nodes = p.split('.');
              var i=0;
              for(;i<nodes.length-1;i++) {
                if(!_.has(objMap,nodes[i])) objMap[nodes[i]]={};
                objMap=objMap[nodes[i]];
              }
              logger.debug(pkgname + '  - updating "'+p+
                           '" from "'+ objMap[nodes[i]] + '" => "' + val +'"');
              objMap[nodes[i]] = val;
              delete params[p];
            }
          }
        }
      }
      cb(err, params, record);
    });
  };

  // add error checks
  //  - err instanceof mongoose.ValidatorError
  schema.statics.createOrUpdate = function(req, record, cb) {
    var body = req.body;
    /*
     * There are cases, where the whole object might
     * be passed within the modelName.
     */
    var modelName = this.modelName.toLowerCase();
    if(body && body[modelName]) {
      body = body[modelName];
    }
    var query = req.query; 
    if(query && query[modelName]) {
      query = query[modelName];
    }
    if(!query) query={};
    // params passed in body overrides any query params
    var params = _.extend(query, body);
    // lets update the query based on params passed
    // remove 'callback', '_method' & '_' (from jsonp)
    // remove 'id' or '_id' from params as well
    params=_.pick(params, _.without(_.keys(params),'callback', '_', '_method', 'id', '_id'));

    logger.debug(pkgname + modelName + ' update with :'+JSON.stringify(params));
    
    if(typeof record == 'undefined') {
      logger.error(pkgname + 'invalid record passed :'+JSON.stringify(params));
      cb('invalid record', record);
      return;
    }
    var self = this;
    self.updateParams(params, record, function(err, params, record) {
      if(err) {
        cb(err, record);
      } else {
        if(!_.isEmpty(params)) {
          logger.error(pkgname + 'Invalid Keys:'+JSON.stringify(params));
        }

        // @todo: If no change, then don't save the record
        //  -- print a message and return back
        logger.info(pkgname + '** updating record:'+record);

        // save the object
        record.save(function(err) { 
          if(err) {
            // send error
            logger.error(pkgname+'Error occured while saving :'+err);
            cb(err, record);
          } else {
            self.loadFullObject(record.id, cb);
          }
        });
      }
    });
  };
};
