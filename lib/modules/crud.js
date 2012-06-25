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
var mongoose = require('mongoose');

// ObjectId reference
var DocumentObjectId = mongoose.Types.ObjectId;

// set up module variables
var pkgname  = '[mongoose-plugins/crud] ';

// exported methods, variables
exports.crudHelpers = function(schema, options) {

  // json output to carry id instead of _id
  schema.methods.toJSON = function (options) {
    var o=this.toObject(); 
    o.id=o._id; 
    delete o._id; 
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
    if(_.isEqual(query,req.query)==false) {
      logger.debug(pkgname + modelName + ' modified request:'+JSON.stringify(query));
    }
    this.find(query, function(err, objs) {
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
      logger.error(pkgname + 'invalid record passed :'+JSON.stringify(params));
    } else {
      res.json(record);
    }
  };

  schema.statics.removeObject = function(record, req, res) {
    var modelName = this.modelName.toLowerCase();
    logger.debug(pkgname + modelName + ' DELETE called with req:'+JSON.stringify(req.query));
    if(typeof record == 'undefined') {
      logger.error(pkgname + 'invalid record passed :'+JSON.stringify(params));
    } else {
      logger.info(pkgname + '** removing:'+JSON.stringify(record));
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
  };

  schema.statics.findObject = function(id, cb) {
    var self = this;
    process.nextTick(function(){
      logger.debug(pkgname + 'find :'+id);
      self.findById(id, function(err, obj) {
        if(err || obj==null) {
          logger.info(pkgname + '  -- NOT found');
        } else {
          logger.debug(pkgname + '  -- found :'+JSON.stringify(obj));
        }
        cb(err, obj);
      });
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
    params=_.pick(params, _.without(_.keys(params),'callback', '_', '_method'));

    logger.debug(pkgname + modelName + ' update with :'+JSON.stringify(params));
    
    if(typeof record == 'undefined') {
      logger.error(pkgname + 'invalid record passed :'+JSON.stringify(params));
      cb('invalid record', record);
      return;
    }

    // First step is to call
    // any ObjectId's that are define in the record
    // to process the parameters
    for(var field in schema.paths) {
      var path = schema.paths[field];
      if(field != '_id' && path.instance=='ObjectID') {
        var className = path.options.ref;
        console.log(className);
      }
    }

    // pass thru the parameters to see 
    // if they can be processed
    for(var p in params) {
      //@todo: raise error if the val is invalid
      if(p && params[p]) {
        var val = params[p];
        //console.log(schema.paths[p]);
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
            if(!objMap.hasOwnProperty(nodes[i])) objMap[nodes[i]]={};
            objMap=objMap[nodes[i]];
          }
          logger.debug(pkgname + '  - updating "'+p+
                       '" from "'+ objMap[nodes[i]] + '" => "' + val +'"');
          objMap[nodes[i]] = val;
        } else {
          // @todo: Later add all the keys and 
          // return back the error in response
          logger.error(pkgname + 'Invalid Key:"'+p+
                       '" with Val:"' + val +'"');
        }
      }
    }
    // @todo: If no change, then don't save the record
    //  -- print a message and return back
    logger.info(pkgname + '** updating:'+JSON.stringify(record));
    record.save(function(err) { 
      if(err) {
        // send error
        logger.error(pkgname+'Error occured while saving :'+err);
      }
      cb(err, record);
    });
  }
};
