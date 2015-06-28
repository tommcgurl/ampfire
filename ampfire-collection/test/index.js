/*
 * Tests based off the original BackboneFire test specs
 */ 
var mocha = require('mocha'),
  expect = require('chai').expect,
  AmpfireCollection = require('../ampfire-collection'),
  Firebase = require('firebase');

describe('ampfire-collection', function() {
  it('should exist', function() {
    // assert that AmpfireCollection is truthy
    return expect(AmpfireCollection).to.be.ok;
  });

  it('should extend', function() {
    var Collection = AmpfireCollection.extend({
      url: 'https://<your-firebase>.firebaseio.com/todos'
    });
    return expect(Collection).to.be.ok;
  });

  it('should extend construct', function() {
    var Collection = AmpfireCollection.extend({
      url: 'https://<your-firebase>.firebaseio.com/todos'
    });
    return expect(new Collection()).to.be.ok;
  });

  it('should throw an error if an invalid url is provided', function() {
     var Collection = AmpfireCollection.extend({
       url: true
     });
     try {
       var model = new Collection();
     } catch (err) {
       expect(err.message).to.be.equal('url parameter required');
     }
   });

});
