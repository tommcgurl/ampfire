# AmpFire-Collection
A modified, CommonJS version of Firebase's [BackboneFire](https://github.com/firebase/backbonefire) for [AmpersandJS](http://ampersandjs.com/) Models.

## Installation
```
npm install ampfire-model
```
If you want it automatically added to your project's *package.json* use:
```
npm install ampfire-model --save
```

## Basic Usage
First you should require the module.
``` javascript
var AmpfireModel = require('./ampfire-model');
```
Next simply extend the AmpfireModel passing it the firebase url
```javascript
  var RealtimeModel = AmpfireModel.extend({
    url: 'https://example-db.firebaseio.com/todos',
    autoSync: true // true by default
  });
 
  // Instantiate the model
  var realtimeModel = new RealtimeModel();

  realtimeModel.on('sync', function(model) {
    console.log('model loaded', model);
  });
```
The rest of the API is the same as that of [BackboneFire](https://github.com/firebase/backbonefire)

## Dependencies
- [ampersand-model](https://github.com/AmpersandJS/ampersand-model)
- lodash functions
    + extend: lodash.object
    + keys: lodash.object
    + defaults: lodash.object
    + result: lodash.object
    + isObject: lodash.lang
    + isFunction: lodash.lang
    + difference: lodash/array/difference
    + bind: lodash/function/bind
    + each: lodash/collection/eac

## Tests
Coming soon...

## Demo
Coming soon...

## Credits
This is all just a modification of the amazing work the [Firebase](https://github.com/firebase) team did on [BackboneFire](https://github.com/firebase/backbonefire). It uses the awesome [AmpersandJS Framework](http://ampersandjs.com/) from the guys over at [&yet](https://github.com/andyet).

## Licence
MIT
