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
        Data: params.data,
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

  test('should fail is `doc` is not an object', () => {
    expect(() => create({ db, tenant, type, key, maxGSIK })(1)).toThrow(
      'Doc is not an object'
    );
  });

  test('should append the tenant id if defined', () => {
    var tenant = '111';
    return create({ db, tenant, type, key, maxGSIK })({
      [key]: 'Something'
    }).then(doc => expect(doc.id.indexOf(tenant + '#')).toEqual(0));
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2', 'EdgeList[]', 'EdgeList2[]'];
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

  test('should create the node and all its edges', () => {
    var edgeListA = cuid();
    var edgeListB = cuid();
    var edgeList2A = cuid();
    var edgeList2B = cuid();
    return create$({
      [key]: 'Something',
      Edge1: edge1,
      Edge2: edge2,
      EdgeList: [edgeListA, edgeListB],
      EdgeList2: [edgeList2A, edgeList2B]
    }).then(doc => {
      var node = doc.id;
      expect(db.createEdge.callCount).toBe(6);
      var edgeListIds = Object.keys(doc.EdgeList).filter(
        key => key.indexOf('@') === -1
      );
      var edgeList2Ids = Object.keys(doc.EdgeList2).filter(
        key => key.indexOf('@') === -1
      );
      expect(doc).toEqual({
        id: node,
        [key]: 'Something',
        Edge1: edge1,
        '@Edge1': 'Cool',
        Edge2: edge2,
        '@Edge2': 'Cool',
        EdgeList: {
          [edgeListIds[0]]: edgeListA,
          [`@${edgeListIds[0]}`]: 'Cool',
          [edgeListIds[1]]: edgeListB,
          [`@${edgeListIds[1]}`]: 'Cool'
        },
        EdgeList2: {
          [edgeList2Ids[0]]: edgeList2A,
          [`@${edgeList2Ids[0]}`]: 'Cool',
          [edgeList2Ids[1]]: edgeList2B,
          [`@${edgeList2Ids[1]}`]: 'Cool'
        }
      });
    });
  });
});
