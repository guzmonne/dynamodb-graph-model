'use strict';

var sinon = require('sinon');
var cuid = require('cuid');
var update = require('../../src/update.js');

var db = {
  createProperty: params => {
    return Promise.resolve({
      Item: {
        Node: params.node,
        Type: params.type,
        Data: JSON.stringify(params.data),
        GSIK: params.node + '#1'
      }
    });
  },
  createEdge: params => {
    return Promise.resolve({
      Item: {
        Node: params.node,
        Type: params.type,
        Data: 'Cool',
        GSIK: params.node + '#1',
        Target: params.target
      }
    });
  }
};
var type = 'Test',
  maxGSIK = 0,
  key = 'ExampleKey',
  tenant = cuid(),
  node = cuid();

describe('update()', () => {
  beforeEach(() => {
    sinon.spy(db, 'createProperty');
    sinon.spy(db, 'createEdge');
  });

  afterEach(() => {
    db.createProperty.restore();
    db.createEdge.restore();
  });

  test('should be a function', () => {
    expect(typeof update).toEqual('function');
  });

  test('should throw if the db is undefined', () => {
    expect(() => update({ tenant, type, key, maxGSIK })).toThrow(
      'DB driver is undefined'
    );
  });

  test('should throw if the type is undefined', () => {
    expect(() => update({ db, tenant, key, maxGSIK })).toThrow(
      'Type is undefined'
    );
  });

  test('should throw if the key is undefined', () => {
    expect(() => update({ db, tenant, type, maxGSIK })).toThrow(
      'Key is undefined'
    );
  });

  test('should return a function', () => {
    expect(typeof update({ db, tenant, type, key, maxGSIK })).toEqual(
      'function'
    );
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2'];
  var edge1 = cuid();
  var edge2 = cuid();
  var update$ = update({
    db,
    tenant,
    type,
    key,
    maxGSIK,
    properties,
    edges
  });

  test('should return a promise', () => {
    expect(update$({ id: node, [key]: 'Something' }) instanceof Promise).toBe(
      true
    );
  });

  test('should update all its properties', () => {
    return update$({
      id: node,
      [key]: 'Something',
      One: 2,
      Two: 3,
      Three: 4
    }).then(doc => {
      var node = doc.id;
      expect(db.createProperty.calledThrice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: 'Something',
        One: 2,
        Two: 3,
        Three: 4
      });
    });
  });

  test('should update all its edges', () => {
    return update$({
      id: node,
      [key]: 'Something',
      Edge1: edge1,
      Edge2: edge2
    }).then(doc => {
      var node = doc.id;
      expect(db.createEdge.calledTwice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: 'Something',
        Edge1: edge1,
        '@Edge1': 'Cool',
        Edge2: edge2,
        '@Edge2': 'Cool'
      });
    });
  });
});
