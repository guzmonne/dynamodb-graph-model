'use strict';

var sinon = require('sinon');
var cuid = require('cuid');
var get = require('../../src/get.js');

var node = cuid(),
  type = 'Test',
  maxGSIK = 0,
  key = 'ExampleKey',
  data = 'TestData',
  tenant = cuid();

var db = {
  getNode: params => {
    return Promise.resolve({
      Item: {
        Node: node,
        Type: type,
        Data: data,
        Target: node,
        GSIK: params.node + '#1'
      }
    });
  }
};

describe('get()', () => {
  beforeEach(() => {
    sinon.spy(db, 'getNode');
  });

  afterEach(() => {
    db.getNode.restore();
  });

  test('should be a function', () => {
    expect(typeof get).toEqual('function');
  });

  test('should throw if the db is undefined', () => {
    expect(() => get({ tenant, type, key, maxGSIK })).toThrow(
      'DB driver is undefined'
    );
  });

  test('should throw if the type is undefined', () => {
    expect(() => get({ db, tenant, key, maxGSIK })).toThrow(
      'Type is undefined'
    );
  });

  test('should throw if the key is undefined', () => {
    expect(() => get({ db, tenant, type, maxGSIK })).toThrow(
      'Key is undefined'
    );
  });

  test('should return a function', () => {
    expect(typeof get({ db, tenant, type, key, maxGSIK })).toEqual('function');
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2', 'EdgeList[]', 'EdgeList2[]'];
  var edge1 = cuid();
  var edge2 = cuid();
  var get$ = get({ db, tenant, type, key, maxGSIK, properties, edges });

  test('should return a promise', () => {
    expect(get$({ id: node }) instanceof Promise).toBe(true);
  });

  test('should get all the requested properties', () => {
    return get$({ id: node, properties: ['Prop1', 'Prop2'] }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(doc.id).toBe(node);
      expect(doc[key]).toEqual(data);
    });
  });
});
