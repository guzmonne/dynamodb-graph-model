'use strict';

var isObject = require('lodash/isObject');
var Model = require('../../src/Model.js');

describe('Model', () => {
  afterEach(() => {
    Model.config({
      table: undefined,
      documentClient: undefined,
      maxGSIK: undefined
    });
  });

  test('should be a function', () => {
    expect(typeof Model).toEqual('function');
  });

  test('should fail if table is undefined', () => {
    expect(() => Model()).toThrow('Table is undefined');
  });

  test('should fail if documentClient is undefined', () => {
    expect(() => Model({ table: 'Something' })).toThrow(
      'DynamoDB Document Client is undefined'
    );
  });

  test('should fail if maxGSIK is undefined', () => {
    expect(() => Model({ table: 'Something', documentClient: 'Else' })).toThrow(
      'Max GSIK is undefined'
    );
  });

  test('should fail if key is undefined', () => {
    expect(() =>
      Model({ table: 'Something', documentClient: 'Else', maxGSIK: 4 })
    ).toThrow('Key is undefined');
  });

  test('should return an object', () => {
    expect(
      isObject(
        Model({
          table: 'something',
          documentClient: 'else',
          maxGSIK: 4,
          type: 'Test',
          key: 'Example'
        })
      )
    ).toBe(true);
  });

  describe('.config()', () => {
    test('should be a function', () => {
      expect(typeof Model.config).toEqual('function');
    });

    test('should return an object', () => {
      expect(isObject(Model.config())).toBe(true);
    });

    test('should update valid global configuration options', () => {
      var result = Model.config({ table: 'Something' });
      expect(result.table).toEqual('Something');
    });

    test('should allow to set options to undefined', () => {
      var result = Model.config({ table: undefined });
      expect(result.table).toBe(undefined);
    });

    test('should not update invalid global configuration options', () => {
      var result = Model.config({ table: 'Something', foo: 'bar' });
      expect(result.table).toEqual('Something');
      expect(result.foo).not.toEqual('bar');
    });
  });

  var TestModel = Model({
    table: 'something',
    documentClient: 'else',
    maxGSIK: 4,
    type: 'Test',
    key: 'Example'
  });

  describe('#create()', () => {
    test('should be a function', () => {
      expect(typeof TestModel.create).toEqual('function');
    });
  });

  describe('#update()', () => {
    test('should be a function', () => {
      expect(typeof TestModel.update).toEqual('function');
    });
  });
});
