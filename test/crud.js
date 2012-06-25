/*
 * Verfication of crud plugin
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var aonx = require('../index');
var berry = require('berry');

// configuration
mongoose.connect('localhost', 'pluginTests');

// Simple test for testing
var PersonSchema = new Schema({
  name : String,
  age : Number
});
PersonSchema.plugin(aonx.crudHelpers);
var Person = mongoose.model('Person', PersonSchema);

describe('crud tests', function() {
  before(function(done) {
    // wait till the mongoose connection is setup
    mongoose.connection.on('open', function () {
      done();
    });
  });
  describe('/rest queries', function() {
    var record={name:'hello my  name', age:23};
    var mongooseRecord;

    // create 

    it('/create', function(done) {
      // positive test cases
      var req={query:record};
      Person.createObject(req, {
        json: function(obj, code) {
          berry.assert.ok(berry.checkObject(record, obj), 'mismatch');
          mongooseRecord = obj.toObject();
          done();
        }
      });
    });

    // read

    it('/get', function(done) {
      Person.findObject(mongooseRecord._id, function(err, obj) {
        berry.assert.ok(berry.checkObject(mongooseRecord, obj), 'mismatch');
        var req = {query:{id:obj._id}};
        Person.showObject(obj, req, {
          json: function(obj, code) {
            berry.assert.ok(berry.checkObject(record, obj), 'mismatch');
            mongooseRecord = obj.toObject();
            done();
          }
        });
      });
    });

    // delete

    it('/delete', function(done) {
      Person.findObject(mongooseRecord._id, function(err, obj) {
        berry.assert.ok(berry.checkObject(mongooseRecord, obj), 'mismatch');
        var req = {query:{id:obj._id}};
        Person.removeObject(obj, req, {
          send: function(code) {
            berry.assert.ok(code==200, 'mismatch');
            done();
          }
        });
      });
    });

  });
});



/*
var StorySchema = new Schema({
    _creator : { type: Schema.ObjectId, ref: 'Person' }
  , title    : String
});

var Story  = mongoose.model('Story', StorySchema);
mongoose.connection.db.dropDatabase(function () {
mongoose.connection.close();
});

*/
