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

  test('should return a function', () => {
    expect(typeof update({ db, tenant, type, key, maxGSIK })).toEqual(
      'function'
    );
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2', 'EdgeList[]', 'EdgeList2[]'];
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

  test('should throw if id is undefined', () => {
    expect(() => update$({ [key]: 'Something' })).toThrow('Id is undefined');
  });

  test('should return a promise', () => {
    expect(update$({ id: node, [key]: 'Something' }) instanceof Promise).toBe(
      true
    );
  });

  test('should update all its properties', () => {
    return update$({
      id: node,
      One: 2,
      Two: 3,
      Three: 4
    }).then(doc => {
      var node = doc.id;
      expect(db.createProperty.calledThrice).toBe(true);
      expect(
        db.createProperty.calledWith({
          tenant,
          type: 'One',
          node,
          data: 2,
          maxGSIK: 0
        })
      ).toBe(true);
      expect(doc).toEqual({
        id: node,
        One: 2,
        Two: 3,
        Three: 4
      });
    });
  });

  test('should update all its edges', () => {
    return update$({
      id: node,
      Edge1: edge1,
      Edge2: edge2
    }).then(doc => {
      var node = doc.id;
      expect(db.createEdge.calledTwice).toBe(true);
      expect(
        db.createEdge.calledWith({
          tenant,
          type: 'Edge1',
          node,
          target: edge1,
          maxGSIK: 0
        })
      ).toBe(true);
      expect(doc).toEqual({
        id: node,
        Edge1: edge1,
        '@Edge1': 'Cool',
        Edge2: edge2,
        '@Edge2': 'Cool'
      });
    });
  });

  test('should update all its edges', () => {
    var edgeListA = cuid();
    var edgeListB = cuid();
    var edgeList2A = cuid();
    var edgeList2B = cuid();
    return update$({
      id: node,
      Edge1: edge1,
      Edge2: edge2,
      EdgeList: [edgeListA, edgeListB],
      EdgeList2: [edgeList2A, edgeList2B]
    }).then(doc => {
      var node = doc.id;
      var edgeListIds = Object.keys(doc.EdgeList).filter(
        key => key.indexOf('@') === -1
      );
      var edgeList2Ids = Object.keys(doc.EdgeList2).filter(
        key => key.indexOf('@') === -1
      );
      expect(db.createEdge.callCount).toBe(6);
      expect(doc).toEqual({
        id: node,
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
