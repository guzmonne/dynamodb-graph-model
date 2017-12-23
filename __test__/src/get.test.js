'use strict';

var sinon = require('sinon');
var cuid = require('cuid');
var range = require('lodash/range');
var get = require('../../src/get.js');

var node = cuid(),
  type = 'Test',
  maxGSIK = 3,
  key = 'ExampleKey',
  data = 'TestData',
  tenant = cuid(),
  edge1 = cuid(),
  edge2 = cuid(),
  edge3 = cuid(),
  edgeListIds = [],
  targets = [];
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
  },
  getNodeType: params => {
    var type = params.type;
    var target = params.node;
    var data = parseInt(params.type.replace('Prop', '').replace('Edge', ''));
    if (type === 'Edge1') target = edge1;
    if (type === 'Edge2') target = edge2;
    if (type === 'Edge3') target = edge3;
    return Promise.resolve({
      Item: {
        Node: node,
        Type: type,
        Data: data,
        Target: target,
        GSIK: params.node + '#1'
      }
    });
  },
  getNodeTypes: params => {
    var items = range(0, params.limit).map(i => {
      let target = cuid();
      let edgeListId = cuid();
      targets.push(target);
      edgeListIds.push(edgeListId);
      return {
        Type: 'EdgeList' + '#' + edgeListId,
        Data: i,
        Target: target
      };
    });

    if (typeof params.sortKeyValue === 'string') {
      var regExp = new RegExp('^' + params.sortKeyValue);
      items = items.filter(item => {
        return regExp.test(item.Type);
      });
    }

    return Promise.resolve({
      Items: items
    });
  }
};

describe('get()', () => {
  beforeEach(() => {
    sinon.spy(db, 'getNode');
    sinon.spy(db, 'getNodeType');
    sinon.spy(db, 'getNodeTypes');
  });

  afterEach(() => {
    db.getNode.restore();
    db.getNodeType.restore();
    db.getNodeTypes.restore();
    edgeListIds = [];
    targets = [];
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

  var properties = ['Prop1', 'Prop2', 'Prop3'];
  var edges = ['Edge1', 'Edge2', 'Edge3', 'EdgeList[]', 'EdgeList2[]'];
  var get$ = get({ db, tenant, type, key, maxGSIK, properties, edges });

  test('should return a promise', () => {
    expect(get$({ id: node }) instanceof Promise).toBe(true);
  });

  test('should get the node', () => {
    return get$({ id: node }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(doc.id).toBe(node);
      expect(doc[key]).toEqual(data);
    });
  });

  test('should get all the requested properties', () => {
    return get$({ id: node, properties: ['Prop1', 'Prop2'] }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeType.calledTwice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        Prop1: 1,
        Prop2: 2
      });
    });
  });

  test('should return all the properties if `properties === $all`', () => {
    return get$({ id: node, properties: '$all' }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeType.calledThrice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        Prop1: 1,
        Prop2: 2,
        Prop3: 3
      });
    });
  });

  test('should get all the requested edges', () => {
    return get$({ id: node, edges: ['Edge1', 'Edge2'] }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeType.calledTwice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        Edge1: edge1,
        [`@Edge1`]: 1,
        Edge2: edge2,
        [`@Edge2`]: 2
      });
    });
  });

  test('should get all the requested edges if `edges === $all`', () => {
    return get$({ id: node, edges: '$all' }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeType.calledThrice).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        Edge1: edge1,
        [`@Edge1`]: 1,
        Edge2: edge2,
        [`@Edge2`]: 2,
        Edge3: edge3,
        [`@Edge3`]: 3
      });
    });
  });

  test('should set the limit of edgeLists items to 10 by default', () => {
    return get$({
      id: node,
      edgesList: [
        {
          type: 'EdgeList'
        }
      ]
    }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeTypes.calledOnce).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        EdgeList: range(0, 10).reduce(
          (acc, i) =>
            Object.assign(acc, {
              [edgeListIds[i]]: targets[i],
              [`@${edgeListIds[i]}`]: i
            }),
          {}
        )
      });
    });
  });

  test('should allow to set the amount of edgeList items to get', () => {
    var random = Math.floor(Math.random() * 100);
    return get$({
      id: node,
      edgesList: [
        {
          type: 'EdgeList',
          limit: random
        }
      ]
    }).then(doc => {
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeTypes.calledOnce).toBe(true);
      expect(doc).toEqual({
        id: node,
        [key]: data,
        EdgeList: range(0, random).reduce(
          (acc, i) =>
            Object.assign(acc, {
              [edgeListIds[i]]: targets[i],
              [`@${edgeListIds[i]}`]: i
            }),
          {}
        )
      });
    });
  });

  test('should allow to set a custom `beginsWith` condition', () => {
    var random = 1000;
    return get$({
      id: node,
      edgesList: [
        {
          type: 'EdgeList',
          limit: random,
          beginsWith: `cjbit`
        }
      ]
    }).then(doc => {
      var regExp1 = /^cjbit/;
      var regExp2 = /^@cjbit/;
      expect(db.getNode.calledOnce).toBe(true);
      expect(db.getNodeTypes.calledOnce).toBe(true);
      expect(!!doc.EdgeList).toBe(true);
      expect(
        Object.keys(doc.EdgeList).every(
          key => regExp1.test(key) || regExp2.test(key)
        )
      ).toBe(true);
    });
  });
});
