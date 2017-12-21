'use strict';

var sinon = require('sinon');
var cuid = require('cuid');
var create = require('../../src/create.js');

var db = {
  createNode: params => {
    return Promise.resolve({
      Item: {
        Node: params.node,
        Type: params.type,
        Data: JSON.stringify(params.data),
        Target: params.node,
        GSIK: params.node + '#1'
      }
    });
  },
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
  tenant = cuid();

describe('create()', () => {
  beforeEach(() => {
    sinon.spy(db, 'createNode');
    sinon.spy(db, 'createProperty');
    sinon.spy(db, 'createEdge');
  });

  afterEach(() => {
    db.createNode.restore();
    db.createProperty.restore();
    db.createEdge.restore();
  });

  test('should be a function', () => {
    expect(typeof create).toEqual('function');
  });

  test('should throw if the db is undefined', () => {
    expect(() => create({ tenant, type, key, maxGSIK })).toThrow(
      'DB driver is undefined'
    );
  });

  test('should throw if the type is undefined', () => {
    expect(() => create({ db, tenant, key, maxGSIK })).toThrow(
      'Type is undefined'
    );
  });

  test('should throw if the key is undefined', () => {
    expect(() => create({ db, tenant, type, maxGSIK })).toThrow(
      'Key is undefined'
    );
  });

  test('should return a function', () => {
    expect(typeof create({ db, tenant, type, key, maxGSIK })).toEqual(
      'function'
    );
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2'];
  var edge1 = cuid();
  var edge2 = cuid();
  var create$ = create({ db, tenant, type, key, maxGSIK, properties, edges });

  test('should return a promise', () => {
    expect(create$({ [key]: 'Something' }) instanceof Promise).toBe(true);
  });

  test('should create the doc and return it with its new id', () => {
    return create$({ [key]: 'Something' }).then(doc => {
      expect(db.createNode.calledOnce).toBe(true);
      expect(!!doc.id).toBe(true);
      expect(doc[key]).toEqual('Something');
    });
  });

  test('should create the node and all its properties', () => {
    return create$({ [key]: 'Something', One: 1, Two: 2, Three: 3 }).then(
      doc => {
        var node = doc.id;
        expect(db.createProperty.calledThrice).toBe(true);
        expect(doc).toEqual({
          id: node,
          [key]: 'Something',
          One: 1,
          Two: 2,
          Three: 3
        });
      }
    );
  });

  test('should create te node and all its edges', () => {
    return create$({ [key]: 'Something', Edge1: edge1, Edge2: edge2 }).then(
      doc => {
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
      }
    );
  });
});