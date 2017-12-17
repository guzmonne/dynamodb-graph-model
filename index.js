'use strict';

var cuid = require('cuid');
var omit = require('lodash/omit.js');
var isObject = require('lodash/isObject.js');
var isArray = require('lodash/isArray.js');

/**
 * Factory functions that returns a model, than can talk to a DynamoDB table
 * that is used to represent a directed graph.
 * @param {object} options
 * @property {string} type - Node type.
 * @property {string} [tenant=''] - Tenant identifier.
 * @property {number} [maxGSIK=4] - Maximum number of GSIK.
 * @property {DocumentClientDriver} [documentClient] - DynamoDB DocumentClient
 *                                                     driver.
 * @property {object[]} history=[] - History of the model.
 * @property {string} node - Node of the current model.
 */
module.exports = function Model(options = {}) {
  var {
    documentClient,
    maxGSIK = 4,
    node,
    table = process.env.TABLE_NAME,
    tenant = '',
    type,
    history = []
  } = options;

  if (type === undefined) throw new Error('Type is undefined');
  if (typeof maxGSIK !== 'number') throw new Error('Max GSIK is not a number');
  if (table === undefined) throw new Error('Table is undefined');

  if (documentClient === undefined) {
    var AWS = require('aws-sdk');
    AWS.config.update({ region: 'us-east-1' });
    documentClient = new AWS.DynamoDB.DocumentClient();
  }
  /** DynamoDB driver configuration */
  var db = require('dynamodb-graph')({
    db: documentClient,
    table: table
  });

  /** Return */
  return Object.freeze({
    create,
    history: Object.freeze(history.slice()),
    maxGSIK,
    node,
    promise,
    tenant,
    type,
    _documentClient: documentClient
  });
  // ---
  /**
   * Creates a new node, and all its attached properties.
   * @param {object} config - Configuration object.
   * @property {any} data - Main data stored on the node.
   * @property {Property[]|PropertyMap} properties - Property list, or
   *                                                 PropertyMap to turn into a
   *                                                 Property list, and attach
   *                                                 to the node.
   * @return {Promise} Results of all the performed actions.
   */
  function create(config = {}) {
    var { data, properties } = config;
    var _history = [],
      _node;

    if (node) throw new Error('Node already exists');

    return db
      .createNode({
        tenant,
        maxGSIK,
        type,
        data
      })
      .then((response = {}) => {
        if (response.Item === undefined) throw new Error('Item is undefined');

        _node = response.Item.Node;

        _history.push(response);

        if (properties === undefined) return;

        return db
          .createProperties({
            tenant,
            node: _node,
            maxGSIK,
            properties: isArray(properties)
              ? properties
              : mapToProperties(properties)
          })
          .then(response => {
            _history.push(response);
          });
      })
      .then(() => {
        return nextModel({ node: _node, history: _history });
      });
  }
  /**
   * Executes the actions stored on the chain.
   * @returns {Promise} Results of all the performed actions.
   */
  function promise() {
    return Promise.resolve(status);
  }
  /**
   * Transforms a PropertiesMap into a list of Properties.
   * @param {PropertiesMap} properties - Map of properties.
   */
  function mapToProperties(properties) {
    return Object.keys(properties).map(key => [key, properties[key]]);
  }
  /**
   * Returns a new Model based on the current one with some overrided
   * properties.
   * @param {object} override - Model attributes override object.
   */
  function nextModel(override) {
    var options = Object.assign(
      {
        table,
        node,
        type,
        tenant,
        maxGSIK,
        documentClient,
        _history: history
      },
      override
    );
    return Model(options);
  }
};

/**
 * Property object to attach to a node.
 * @typedef {Object} Property
 * @property {string} type - Property type.
 * @property {any} data - Value of the property.
 *
 * Key/Value dictionary that can be converted into a list of properties.
 * @typedef {Object} PropertyMap
 * @property {any} [any] - Key value pairs.
 */
