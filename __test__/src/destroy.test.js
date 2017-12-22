'use strict';

var sinon = require('sinon');
var cuid = require('cuid');
var destroy = require('../../src/destroy.js');

var db = {
  deleteNode: params => {
    return Promise.resolve(undefined);
  }
};
var type = 'Test',
  maxGSIK = 0,
  tenant = cuid(),
  node = cuid();

describe('destroy()', () => {
  beforeEach(() => {
    sinon.spy(db, 'deleteNode');
  });

  afterEach(() => {
    db.deleteNode.restore();
  });

  test('should be a function', () => {
    expect(typeof destroy).toEqual('function');
  });

  test('should throw if the db is undefined', () => {
    expect(() => destroy({ tenant, type, maxGSIK })).toThrow(
      'DB driver is undefined'
    );
  });

  test('should return a function', () => {
    expect(typeof destroy({ db, tenant, maxGSIK })).toEqual('function');
  });

  var properties = ['One', 'Two', 'Three'];
  var edges = ['Edge1', 'Edge2'];
  var edge1 = cuid();
  var edge2 = cuid();
  var destroy$ = destroy({
    db,
    tenant,
    type,
    maxGSIK
  });

  test('should throw if id is undefined', () => {
    expect(() => destroy$({ id: undefined })).toThrow('ID is undefined');
  });

  test('should return a promise', () => {
    expect(destroy$({ id: node }) instanceof Promise).toBe(true);
  });

  test('should destroy then node and all its properties', () => {
    return destroy$({ id: node }).then(doc => {
      expect(db.deleteNode.calledOnce).toBe(true);
      expect(doc).toBe(undefined);
    });
  });
});
