'use strict';

var AWS = require('aws-sdk');
var cuid = require('cuid');
var Model = require('../index.js');

var table = 'TestTable';
var type = 'Test';
var maxGSIK = 5;

describe('Model', () => {
  test('should return an object', () => {
    expect(typeof Model({ table, type, maxGSIK })).toEqual('object');
  });

  test('should return an error if type is undefined', () => {
    expect(() => Model({ table, maxGSIK })).toThrow('Type is undefined');
  });

  test('should return an error if maxGSIK is not a number', () => {
    expect(() => Model({ table, type, maxGSIK: '' })).toThrow(
      'Max GSIK is not a number'
    );
  });

  test('should create an instance of AWS.DynamoDB.DocumentClient if a documentClient driver is not provided', () => {
    expect(
      Model({ table, type, maxGSIK })._documentClient instanceof
        AWS.DynamoDB.DocumentClient
    ).toBe(true);
  });

  describe('#promise()', () => {
    test('should return a promise', () => {
      expect;
    });
  });

  describe('#create()', () => {
    var documentClient = {
      put: params => ({ promise: () => Promise.resolve(params) }),
      batchWrite: params => ({ promise: () => Promise.resolve(params) })
    };
    var maxGSIK = 0;
    var data = 'example';
    var tenant = cuid();
    var Test = Model({ tenant, table, type, maxGSIK, documentClient });

    test('should throw an error if data is undefined', () => {
      expect(() => Test.create()).toThrow('Data is undefined');
    });

    test('should create just the node if properties is undefined', () => {
      return Test.create({ data })
        .then(result => {
          var node = result.node;
          expect(result.history[0]).toEqual({
            TableName: table,
            Item: {
              Data: JSON.stringify(data),
              Node: node,
              Target: node,
              Type: type,
              GSIK: node + '#' + 1
            }
          });
          expect(result.history[1]).toBe(undefined);
        })
        .catch(error => expect(error.message).toBe(null));
    });

    test('should create the properties on the correct node', () => {
      var properties = [['One', 1], ['Two', 2]];
      return Test.create({ data, properties }).then(result => {
        var node = result.node;
        expect(result.history[0]).toEqual({
          TableName: table,
          Item: {
            Data: JSON.stringify(data),
            Node: node,
            Target: node,
            Type: type,
            GSIK: node + '#' + 1
          }
        });
        expect(result.history[1]).toEqual([
          {
            RequestItems: {
              TestTable: [
                {
                  PutRequest: {
                    Item: {
                      Node: node,
                      Type: 'One',
                      Data: '1',
                      GSIK: node + '#1'
                    }
                  }
                },
                {
                  PutRequest: {
                    Item: {
                      Node: node,
                      Type: 'Two',
                      Data: '2',
                      GSIK: node + '#1'
                    }
                  }
                }
              ]
            }
          }
        ]);
      });
    });
  });
});
