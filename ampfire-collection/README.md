# AmpFire-Collection
A modified, CommonJS version of Firebase's [BackboneFire](https://github.com/firebase/backbonefire) for [AmpersandJS](http://ampersandjs.com/) Collections.

## Installation
```
npm install ampfire-collection
```
If you want it automatically added to your project's *package.json* use:
```
npm install ampfire-collection --save
```

## Info
- It supports the [ampersand-rest-collection](https://github.com/ampersandjs/ampersand-rest-collection) module.
- The [ampersand-collection](https://github.com/ampersandjs/ampersand-collection) with the [ampersand-collection-rest-mixin](https://github.com/ampersandjs/ampersand-collection-rest-mixin) can be used if the lodash functions aren't needed.

## Basic Usage
First you should require the module as well as the [ampersand-model module](https://github.com/AmpersandJS/ampersand-model) for creating our collection's model instances.
``` javascript
var AmpfireCollection = require('ampfire-collection');
var Model = require('ampersand-model');
```
Then you can create an ampersand-model to pass to your collection
```javascript
var ExampleModel = Model.extend({
    props: {
      date: 'string',
      name: 'string',
      url: 'string',
      viewed: 'boolean',
      id: 'string'
    }
  });
```
Next simply extend the AmpfireCollection passing it our newly created *ExampleModel* and the firebase url
```javascript
  var RealtimeCollection = AmpfireCollection.extend({
    url: 'https://example-db.firebaseio.com/todos',
    model: ExampleModel,
    autoSync: true // true by default
  });
 
  // Instantiate the collection
  var realtimeCollection = new RealtimeCollection();

  realtimeCollection.on('sync', function(collection) {
    console.log('collection loaded', collection);
  });
```
The rest of the API is the same as that of [BackboneFire](https://github.com/firebase/backbonefire)

## Dependencies
- [ampersand-rest-collection](https://github.com/AmpersandJS/ampersand-rest-collection) module
- lodash functions
    + extend: lodash.object
    + keys: lodash.object
    + has: lodash.object
    + isObject: lodash.lang
    + isFunction: lodash.lang
    + isArray: lodash.lang
    + clone: lodash.lang
    + bind: lodash.function
    + defer: lodash.function
    + each: lodash.collection
    + find: lodash.collection,
    + difference: lodash.array
    + union: lodash.array

## Tests
Coming soon...

## Demo
Coming soon...

## Credits
This is all just a modification of the amazing work the [Firebase](https://github.com/firebase) team did on [BackboneFire](https://github.com/firebase/backbonefire). It uses the awesome [AmpersandJS Framework](http://ampersandjs.com/) from the guys over at [&yet](https://github.com/andyet).

## Licence
MIT
