/**
 * A modified, CommonJS version of https://github.com/firebase/backbonefire
 * made to support AmpersandJS Collections (https://github.com/AmpersandJS/ampersand-collection)
 * rather than backbone collections
 */
var Collection = require('ampersand-rest-collection');

// var Ampersand = require('Ampersand');

var Ampersand = {
  Collection: Collection
};

var Ampfire = {};

/**
 * A utility for retrieving the key name of a Firebase ref or
 * DataSnapshot. This is backwards-compatible with `name()`
 * from Firebase 1.x.x and `key()` from Firebase 2.0.0+. Once
 * support for Firebase 1.x.x is dropped in AmpersandFire, this
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
 * All Ampersand crud calls (destroy, add, create, save...) will pipe into
 * this method. This way Ampersand can handle the prepping of the models
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
 * A utility for a determining whether a string or a Firebase
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
 * Find the deleted keys and set their values to null
 * so Firebase properly deletes them.
 */
Ampfire._updateModel = function(model) {
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
};

var OnceCollection = (function() {
  function OnceCollection() {

  }
  OnceCollection.protoype = {
    /**
     * Create an id from a Firebase push-id and call Ampersand.create, which
     * will do prepare the models and trigger the proper events and then call
     * Ampfire.sync with the correct method.
     */
    create: function(model, options) {
      model.id = Ampfire._getKey(this.firebase.push());
      options = _.extend({
        autoSync: false
      }, options);
      return Ampersand.Collection.prototype.create.call(this, model, options);
    },
    /**
     * Create an id from a Firebase push-id and call Ampersand.add, which
     * will do prepare the models and trigger the proper events and then call
     * Ampfire.sync with the correct method.
     */
    add: function(model, options) {
      model.id = Ampfire._getKey(this.firebase.push());
      options = _.extend({
        autoSync: false
      }, options);
      return Ampersand.Collection.prototype.add.call(this, model, options);
    },
    /**
     * Proxy to Ampfire.sync
     */
    sync: function(method, model, options) {
      Ampfire.sync(method, model, options);
    },
    /**
     * Firebase returns lists as an object with keys, where Ampersand
     * collections require an array. This function modifies the existing
     * Ampersand.Collection.fetch method by mapping the returned object from
     * Firebase to an array that Ampersand can use.
     */
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) {
        options.parse = true;
      }
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var arr = [];
        var keys = _.keys(resp);
        _.each(keys, function(key) {
          arr.push(resp[key]);
        });
        var method = options.reset ? 'reset' : 'set';
        collection[method](arr, options);
        if (success) {
          success(collection, arr, options);
        }
        options.autoSync = false;
        options.url = this.url;
        collection.trigger('sync', collection, arr, options);
      };
      return this.sync('read', this, options);
    }
  };

  return OnceCollection;
}());

var SyncCollection = (function() {

  function SyncCollection() {
    this._initialSync = {};
    // Add handlers for remote events
    this.firebase.on('child_added', _.bind(this._childAdded, this));
    this.firebase.on('child_moved', _.bind(this._childMoved, this));
    this.firebase.on('child_changed', _.bind(this._childChanged, this));
    this.firebase.on('child_removed', _.bind(this._childRemoved, this));

    // Once handler to emit 'sync' event whenever data changes
    // Defer the listener incase the data is cached, because
    // then the once call would be synchronous
    _.defer(_.bind(function() {

      this.firebase.once('value', function() {
        // indicate that the call has been received from the server
        // and the data has successfully loaded
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

    }, this));

    // Handle changes in any local models.
    this.listenTo(this, 'change', this._updateModel, this);
    // Listen for destroy event to remove models.
    this.listenTo(this, 'destroy', this._removeModel, this);
  }

  SyncCollection.protoype = {
    add: function(models, options) {
      // prepare models
      var parsed = this._parseModels(models);
      options = options ? _.clone(options) : {};
      options.success =
        _.isFunction(options.success) ? options.success : function() {};

      for (var i = 0; i < parsed.length; i++) {
        var model = parsed[i];

        if (options.silent === true) {
          this._suppressEvent = true;
        }

        var childRef = this.firebase.ref().child(model.id);
        childRef.set(model, _.bind(options.success, model));
      }

      return parsed;
    },

    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (options.wait) {
        this._log('Wait option provided to create, ignoring.');
      }
      if (!model) {
        return false;
      }
      var set = this.add([model], options);
      return set[0];
    },

    remove: function(models, options) {
      var parsed = this._parseModels(models);
      options = options ? _.clone(options) : {};
      options.success =
        _.isFunction(options.success) ? options.success : function() {};

      for (var i = 0; i < parsed.length; i++) {
        var model = parsed[i];
        var childRef = this.firebase.child(model.id);
        if (options.silent === true) {
          this._suppressEvent = true;
        }
        Ampfire._setWithCheck(childRef, null, options);
      }

      return parsed;
    },

    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      // Remove all models remotely.
      this.remove(this.models, {
        silent: true
      });
      // Add new models.
      var ret = this.add(models, {
        silent: true
      });
      // Trigger 'reset' event.
      if (!options.silent) {
        this.trigger('reset', this, options);
      }
      return ret;
    },

    // This function does not actually fetch data from the server.
    // Rather, the "sync" event is fired when data has been loaded
    // from the server. Since the _initialSync property will indicate
    // whether the initial load has occurred, the "sync" event can
    // be fired once _initialSync has been resolved.
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
    },

    _log: function(msg) {
      if (console && console.log) {
        console.log(msg);
      }
    },

    _parseModels: function(models, options) {
      var pushArray = [];
      // check if the models paramter is an array or a single object
      var singular = !_.isArray(models);
      // if the models parameter is a single object then wrap it into an array
      models = singular ? (models ? [models] : []) : models.slice();

      for (var i = 0; i < models.length; i++) {
        var model = models[i];

        if (!model.id) {
          model.id = Ampfire._getKey(this.firebase.push());
        }

        // call Ampersand's prepareModel to apply options
        model = Ampersand.Collection.prototype._prepareModel.call(
          this, model, options
        );

        if (model.toJSON && typeof model.toJSON === 'function') {
          model = model.toJSON();
        }

        pushArray.push(model);

      }

      return pushArray;
    },

    _childAdded: function(snap) {
      var model = Ampfire._checkId(snap);

      if (this._suppressEvent === true) {
        this._suppressEvent = false;
        Ampersand.Collection.prototype.add.call(this, [model], {
          silent: true
        });
      } else {
        Ampersand.Collection.prototype.add.call(this, [model]);
      }
      this.get(model.id)._remoteAttributes = model;
    },

    // TODO: child_moved is emitted when the priority for a child is changed, so it
    // should update the priority of the model and maybe trigger a sort
    _childMoved: function() {

    },

    // when a model has changed remotely find differences between the
    // local and remote data and apply them to the local model
    _childChanged: function(snap) {
      var model = Ampfire._checkId(snap);

      var item = _.find(this.models, function(child) {
        return child.id === model.id;
      });

      if (!item) {
        // TODO: Investigate: what is the right way to handle this case?
        //throw new Error('Could not find model with ID ' + model.id);
        this._childAdded(snap);
        return;
      }

      this._preventSync(item, true);
      item._remoteAttributes = model;

      // find the attributes that have been deleted remotely and
      // unset them locally
      var diff = _.difference(_.keys(item.attributes), _.keys(model));
      _.each(diff, function(key) {
        item.unset(key);
      });

      item.set(model);
      // fire sync since this is a response from the server
      this.trigger('sync', this);
      this._preventSync(item, false);
    },

    // remove an item from the collection when removed remotely
    // provides the ability to remove siliently
    _childRemoved: function(snap) {
      var model = Ampfire._checkId(snap);

      if (this._suppressEvent === true) {
        this._suppressEvent = false;
        Ampersand.Collection.prototype.remove.call(
          this, [model], {
            silent: true
          }
        );
      } else {
        // trigger sync because data has been received from the server
        this.trigger('sync', this);
        Ampersand.Collection.prototype.remove.call(this, [model]);
      }
    },

    // Add handlers for all models in this collection, and any future ones
    // that may be added.
    _updateModel: function(model) {
      var remoteAttributes;
      var localAttributes;
      var updateAttributes;
      var ref;

      // if the model is already being handled by listeners then return
      if (model._remoteChanging) {
        return;
      }

      remoteAttributes = model._remoteAttributes || {};
      localAttributes = model.toJSON();

      // consolidate the updates to Firebase
      updateAttributes = this._compareAttributes(remoteAttributes, localAttributes);

      ref = this.firebase.ref().child(model.id);

      // if '.priority' is present setWithPriority
      // else do a regular update
      if (_.has(updateAttributes, '.priority')) {
        this._setWithPriority(ref, localAttributes);
      } else {
        this._updateToFirebase(ref, localAttributes);
      }

    },

    // set the attributes to be updated to Firebase
    // set any removed attributes to null so that Firebase removes them
    _compareAttributes: function(remoteAttributes, localAttributes) {
      var updateAttributes = {};

      var union = _.union(_.keys(remoteAttributes), _.keys(localAttributes));

      _.each(union, function(key) {
        if (!_.has(localAttributes, key)) {
          updateAttributes[key] = null;
        } else if (localAttributes[key] !== remoteAttributes[key]) {
          updateAttributes[key] = localAttributes[key];
        }
      });

      return updateAttributes;
    },

    // Special case if '.priority' was updated - a merge is not
    // allowed so we'll have to do a full setWithPriority.
    _setWithPriority: function(ref, item) {
      var priority = item['.priority'];
      delete item['.priority'];
      ref.setWithPriority(item, priority);
      return item;
    },

    // TODO: possibly pass in options for onComplete callback
    _updateToFirebase: function(ref, item) {
      ref.update(item);
    },

    // Triggered when model.destroy() is called on one of the children.
    _removeModel: function(model, collection, options) {
      options = options ? _.clone(options) : {};
      options.success =
        _.isFunction(options.success) ? options.success : function() {};
      var childRef = this.firebase.child(model.id);
      Ampfire._setWithCheck(childRef, null, _.bind(options.success, model));
    },

    _preventSync: function(model, state) {
      model._remoteChanging = state;
    }
  };

  return SyncCollection;
}());

Ampfire.Collection = Ampersand.Collection.extend({

  constructor: function(model, options) {
    Ampersand.Collection.apply(this, arguments);
    var self = this;
    var BaseModel = self.model;
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
        throw new Error('url parameter required');
    }

    // if we are not autoSyncing, the model needs
    // to be a non-autoSynced model
    if (!this.autoSync) {
      _.extend(this, OnceCollection.protoype);
      OnceCollection.apply(this, arguments);
    } else {
      _.extend(this, SyncCollection.protoype);
      SyncCollection.apply(this, arguments);
    }

    // Intercept the given model and give it a firebase ref.
    // Have it listen to local changes silently. When attributes
    // are unset, the callback will set them to null so that they
    // are removed on the Firebase server.
    this.model = function(attrs, opts) {

      var newItem = new BaseModel(attrs, opts);
      newItem.autoSync = false;
      newItem.firebase = self.firebase.ref().child(newItem.id);
      newItem.sync = Ampfire.sync;
      newItem.on('change', function(model) {
        var updated = Ampfire._updateModel(model);
        model.set(updated, {
          silent: true
        });
      });

      return newItem;

    };

  },

  comparator: function(model) {
    return model.id;
  }
});
module.exports = Ampfire.Collection;
