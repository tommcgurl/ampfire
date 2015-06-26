/**
 * A modified, CommonJS version of https://github.com/firebase/backbonefire
 * made to support AmpersandJS Models (https://github.com/AmpersandJS/ampersand-model)
 * rather than backbone models
 */
'use strict';

//Lodash functions
var _ = {
  extend: require('lodash/object/extend'),
  keys: require('lodash/object/keys'),
  defaults: require('lodash/object/defaults'),
  result: require('lodash/object/result'),
  isObject: require('lodash/lang/isObject'),
  isFunction: require('lodash/lang/isFunction'),
  difference: require('lodash/array/difference'),
  bind: require('lodash/function/bind'),
  each: require('lodash/collection/each')
};
var Model = require('ampersand-model');

var Ampersand = {
  Model: Model
};
var Ampfire = {};

/**
 * A utility for retrieving the key name of a Firebase ref or
 * DataSnapshot. This is backwards-compatible with `name()`
 * from Firebase 1.x.x and `key()` from Firebase 2.0.0+. Once
 * support for Firebase 1.x.x is dropped in BackboneFire, this
 * helper can be removed.
 */
Ampfire._getKey = function(refOrSnapshot) {
  return (typeof refOrSnapshot.key === 'function') ? refOrSnapshot.key() : refOrSnapshot.name();
};

/**
 * A utility for resolving whether an item will have the autoSync
 * property. Models can have this property on the prototype.
 */
Ampfire._determineAutoSync = function(model, options) {
  var proto = Object.getPrototypeOf(model);
  return _.extend({
      autoSync: proto.hasOwnProperty('autoSync') ? proto.autoSync : true
    },
    this,
    options
  ).autoSync;
};

/**
 * Overriding of Ampersand.sync.
 * All Backbone crud calls (destroy, add, create, save...) will pipe into
 * this method. This way Backbone can handle the prepping of the models
 * and the trigering of the appropiate methods. While sync can be overwritten
 * to handle updates to Firebase.
 */
Ampfire.sync = function(method, model, options) {
  var modelJSON = model.toJSON();

  if (method === 'read') {

    Ampfire._readOnce(model.firebase, function onComplete(snap) {
      var resp = snap.val();
      if (options.success) {
        options.success(resp);
      }
    }, function _readOnceError(err) {
      if (options.error) {
        options.error(err);
      }
    });

  } else if (method === 'create') {

    Ampfire._setWithCheck(model.firebase, modelJSON, options);

  } else if (method === 'update') {

    Ampfire._updateWithCheck(model.firebase, modelJSON, options);

  } else if (method === 'delete') {

    Ampfire._setWithCheck(model.firebase, null, options);

  }

};

/**
 * A utility for a one-time read from Firebase.
 */
Ampfire._readOnce = function(ref, onComplete) {
  ref.once('value', onComplete);
};

/**
 * A utility for a destructive save to Firebase.
 */
Ampfire._setToFirebase = function(ref, item, onComplete) {
  ref.set(item, onComplete);
};


/**
 * A utility for a non-destructive save to Firebase.
 */
Ampfire._updateToFirebase = function(ref, item, onComplete) {
  ref.update(item, onComplete);
};

/**
 * A utility for success and error events that are called after updates
 * from Firebase.
 */
Ampfire._onCompleteCheck = function(err, item, options) {
  if (!options) {
    return;
  }

  if (err && options.error) {
    options.error(item, err, options);
  } else if (options.success) {
    options.success(item, null, options);
  }
};

/**
 * A utility for a destructive save to Firebase that handles success and
 * error events from the server.
 */
Ampfire._setWithCheck = function(ref, item, options) {
  Ampfire._setToFirebase(ref, item, function(err) {
    Ampfire._onCompleteCheck(err, item, options);
  });
};

/**
 * A utility for a non-destructive save to Firebase that handles success and
 * error events from the server.
 */
Ampfire._updateWithCheck = function(ref, item, options) {
  Ampfire._updateToFirebase(ref, item, function(err) {
    Ampfire._onCompleteCheck(err, item, options);
  });
};

/**
 * A utility for throwing errors.
 */
Ampfire._throwError = function(message) {
  throw new Error(message);
};


/**
 * A utility for determining whether a string or a Firebase
 * reference should be returned.
 *    string - return new Firebase('')
 *    object - assume object is ref and return
 */
Ampfire._determineRef = function(objOrString) {
  switch (typeof(objOrString)) {
    case 'string':
      return new Firebase(objOrString);
    case 'object':
      return objOrString;
    default:
      Ampfire._throwError('Invalid type passed to url property');
  }
};

/**
 * A utility for assigning an id from a snapshot.
 *    object    - Assign id from snapshot key
 *    primitive - Throw error, primitives cannot be synced
 *    null      - Create blank object and assign id
 */
Ampfire._checkId = function(snap) {
  var model = snap.val();

  // if the model is a primitive throw an error
  if (Ampfire._isPrimitive(model)) {
    Ampfire._throwError('InvalidIdException: Models must have an Id. Note: You may ' +
      'be trying to sync a primitive value (int, string, bool).');
  }

  // if the model is null set it to an empty object and assign its id
  // this way listeners can still be attached to populate the object in the future
  if (model === null) {
    model = {};
  }

  // set the id to the snapshot's key
  model.id = Ampfire._getKey(snap);

  return model;
};

/**
 * A utility for checking if a value is a primitive
 */
Ampfire._isPrimitive = function(value) {
  // is the value not an object and not null (basically, is it a primitive?)
  return !_.isObject(value) && value !== null;
};

/**
 * A naive promise-like implementation. Requires a syncPromise object.
 *
 * syncPromise is an object that has three properties.
 *  - resolve (bool) - Has the data been retreived from the server?
 *  - success (bool) - Was the data retrieved successfully?
 *  - error (Error)  - If there was an error, return the error object.
 *
 * This function relies on the syncPromise object being resolved from an
 * outside source. When the "resolve" property has been set to true,
 * the "success" and "error" functions will be evaluated.
 */
Ampfire._promiseEvent = function(params) {
  // setup default values
  var syncPromise = params.syncPromise;
  var success = params.success;
  var error = params.error;
  var context = params.context || this;
  var complete = params.complete;

  // set up an interval that checks to see if data has been synced from the server
  var promiseInterval = setInterval(_.bind(function() {
    // if the result has been retrieved from the server
    if (syncPromise.resolve) {

      // on success fire off the event
      if (syncPromise.success) {
        success.call(context);
      }
      // on error fire off the returned error
      else if (syncPromise.err) {
        error.call(context, syncPromise.err);
      }

      // fire off the provided completed event
      if (complete) {
        complete.call(context);
      }

      // the "promise" has been resolved, clear the interval
      clearInterval(promiseInterval);
    }
  }, context));

};

/**
 * Model responsible for autoSynced objects
 * This model is never directly used. The Ampfire.Model will
 * inherit from this if it is an autoSynced model
 */
var SyncModel = (function() {

  function SyncModel() {
    // Set up sync events
    this._initialSync = {};
    // apply remote changes locally
    this.firebase.on('value', function(snap) {
      this._setLocal(snap);
      this._initialSync.resolve = true;
      this._initialSync.success = true;
      this.trigger('sync', this, null, null);
    }, function(err) {
      // indicate that the call has been received from the server
      // and that an error has occurred
      this._initialSync.resolve = true;
      this._initialSync.err = err;
      this.trigger('error', this, err, null);
    }, this);

    // apply local changes remotely
    this._listenLocalChange(function(model) {
      this.firebase.update(model);
    });

  }

  SyncModel.protoype = {
    fetch: function(options) {
      Ampfire._promiseEvent({
        syncPromise: this._initialSync,
        context: this,
        success: function() {
          this.trigger('sync', this, null, options);
        },
        error: function(err) {
          this.trigger('err', this, err, options);
        },
        complete: function() {
          Ampfire._onCompleteCheck(this._initialSync.err, this, options);
        }
      });
    }
  };

  return SyncModel;
}());

/**
 * Model responsible for one-time requests
 * This model is never directly used. The Ampfire.Model will
 * inherit from this if it is an autoSynced model
 */
var OnceModel = (function() {

  function OnceModel() {

    // when an unset occurs set the key to null
    // so Firebase knows to delete it on the server
    this._listenLocalChange(function(model) {
      this.set(model, {
        silent: true
      });
    });

  }

  return OnceModel;
}());

Ampfire.Model = Ampersand.Model.extend({
  /*
   * We should allow extra properties by default since we don't
   * always know our firebase object's properties in advance
   */
  extraProperties: 'allow',
  // Determine whether the realtime or once methods apply
  constructor: function(model, options) {
    Ampersand.Model.apply(this, arguments);
    var defaults = _.result(this, 'defaults');

    // Apply defaults only after first sync.
    this.once('sync', function() {
      this.set(_.defaults(this.toJSON(), defaults));
    });

    this.autoSync = Ampfire._determineAutoSync(this, options);

    switch (typeof this.url) {
      case 'string':
        this.firebase = Ampfire._determineRef(this.url);
        break;
      case 'function':
        this.firebase = Ampfire._determineRef(this.url());
        break;
      case 'object':
        this.firebase = Ampfire._determineRef(this.url);
        break;
      default:
        Ampfire._throwError('url parameter required');
    }

    if (!this.autoSync) {
      OnceModel.apply(this, arguments);
      _.extend(this, OnceModel.protoype);
    } else {
      _.extend(this, SyncModel.protoype);
      SyncModel.apply(this, arguments);
    }

  },

  sync: function(method, model, options) {
    Ampfire.sync(method, model, options);
  },

  /**
   * Siliently set the id of the model to the snapshot key
   */
  _setId: function(snap) {
    // if the item new set the name to the id
    if (this.isNew()) {
      this.set('id', Ampfire._getKey(snap), {
        silent: true
      });
    }
  },

  /**
   * Proccess changes from a snapshot and apply locally
   */
  _setLocal: function(snap) {
    var newModel = this._unsetAttributes(snap);
    this.set(newModel);
  },

  /**
   * Unset attributes that have been deleted from the server
   * by comparing the keys that have been removed.
   */
  _unsetAttributes: function(snap) {
    var newModel = Ampfire._checkId(snap);

    if (typeof newModel === 'object' && newModel !== null) {
      var diff = _.difference(_.keys(this.attributes), _.keys(newModel));
      _.each(diff, _.bind(function(key) {
        this.unset(key);
      }, this));
    }

    // check to see if it needs an id
    this._setId(snap);

    return newModel;
  },

  /**
   * Find the deleted keys and set their values to null
   * so Firebase properly deletes them.
   */
  _updateModel: function(model) {
    var modelObj = model.changedAttributes();
    _.each(model.changed, function(value, key) {
      if (typeof value === 'undefined' || value === null) {
        if (key === 'id') {
          delete modelObj[key];
        } else {
          modelObj[key] = null;
        }
      }
    });

    return modelObj;
  },


  /**
   * Determine if the model will update for every local change.
   * Provide a callback function to call events after the update.
   */
  _listenLocalChange: function(cb) {
    var method = cb ? 'on' : 'off';
    this[method]('change', function(model) {
      var newModel = this._updateModel(model);
      if (_.isFunction(cb)) {
        cb.call(this, newModel);
      }
    }, this);
  }

});

module.exports = Ampfire.Model;
