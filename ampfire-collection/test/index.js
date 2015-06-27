var mocha = require('mocha'),
  expect = require('chai').expect,
  AmpfireCollection = require('../ampfire-collection'),
  Firebase = require('client-firebase');

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
});
