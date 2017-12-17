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

  var documentClient = {
    put: params => ({ promise: () => Promise.resolve(params) }),
    batchWrite: params => ({ promise: () => Promise.resolve(params) }),
    query: params => ({ promise: () => Promise.resolve(params) })
  };
  var maxGSIK = 0;
  var data = 'example';
  var tenant = cuid();
  var Test = Model({ tenant, table, type, maxGSIK, documentClient });

  describe('#create()', () => {
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

    test('should create the properties on the correct node if given a properties map', () => {
      var properties = { One: 1, Two: 2 };
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

  describe('#connect()', () => {
    var node = cuid();
    var type = 'Connection';
    var nodeB = cuid();
    var _documentClient = Object.assign({}, documentClient, {
      query: params => ({
        promise: () =>
          Promise.resolve(
            Object.assign({}, params, {
              Items: [
                {
                  Node: nodeB,
                  Target: nodeB,
                  Data: JSON.stringify('Something'),
                  GSIK: nodeB + '#1',
                  Type: 'SomethingElse'
                }
              ]
            })
          )
      })
    });
    var TestC = Model({
      tenant,
      node,
      table,
      type,
      maxGSIK,
      documentClient: _documentClient
    });
    var TestB = Model({
      tenant,
      node: nodeB,
      table,
      type,
      maxGSIK,
      documentClient
    });

    test('should throw an error if node is undefined', () => {
      expect(() => Test.connect({ type })).toThrow('Node is undefined');
    });

    test('should throw an error if target is undefined', () => {
      expect(() => TestC.connect({ type })).toThrow('Target is undefined');
    });

    test('should throw an error if type is undefined', () => {
      expect(() => TestC.connect({ target: cuid() })).toThrow(
        'Type is undefined'
      );
    });

    test('should accept another Model to make the connection', () => {
      expect(() =>
        TestC.connect({
          target: TestB
        })
      ).not.toThrow('End node is undefined');
    });

    test('should save the edge on the database', () => {
      TestC.connect({
        target: TestB,
        type
      })
        .then(result => {
          expect(result.history[0]).toEqual({
            Item: {
              Data: '"Something"',
              GSIK: node + '#1',
              Node: node,
              Target: nodeB,
              Type: 'Connection'
            },
            TableName: 'TestTable'
          });
        })
        .catch(error => console.log(error));
    });
  });
});
