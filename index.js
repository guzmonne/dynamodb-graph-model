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
 * @property {number} [maxGSIK] - Maximum number of GSIK.
 * @property {DocumentClientDriver} [documentClient] - DynamoDB DocumentClient
 *                                                     driver.
 * @property {object[]} history=[] - History of the model.
 * @property {PropertyMap} properties - Map of node properties.
 * @property {EdgesMap} edges - Map of node edges.
 * @property {any} data - Node main data.
 * @property {string} node - Node of the current model.
 */
module.exports = function Model(options = {}) {
  var {
    documentClient,
    maxGSIK,
    node,
    table = process.env.TABLE_NAME,
    tenant = '',
    type,
    history = [],
    properties,
    edges,
    data
  } = options;

  if (type === undefined) throw new Error('Type is undefined');
  if (maxGSIK !== undefined && typeof maxGSIK !== 'number')
    throw new Error('Max GSIK is not a number');
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
  var publicAPI = {
    addProperty,
    create,
    connect,
    get data() {
      return data;
    },
    get edges() {
      return edges;
    },
    get,
    history: Object.freeze(history.slice()),
    get maxGSIK() {
      return maxGSIK;
    },
    get node() {
      return node;
    },
    get tenant() {
      return tenant;
    },
    get type() {
      return type;
    },
    promise,
    get properties() {
      return properties;
    },
    setNode,
    _documentClient: documentClient
  };

  return publicAPI;
  // ---
  /**
   * Sets the new node, and returns the other values to its default.
   * @param {string} newNode - New node ID.
   * @param {Model} Returns a new Model with the new node.
   */
  function setNode(newNode) {
    node = newNode;
    data = undefined;
    properties = {};
    edges = {};
    history.push({ setNode: newNode });
    return publicAPI;
  }
  /**
   * Gets the node data, properties, and edge information.
   * @return {Promise} Next model with the resulting data.
   */
  function get() {
    var _history = [],
      data,
      properties,
      edges;

    if (node === undefined) throw new Error('Node is undefined');

    return Promise.all([
      db.getNodeData(node),
      db.getNodeProperties(node),
      db.getNodeEdges(node)
    ]).then(results => {
      var [dataResult, propertiesResult, edgesResult] = results;
      data = dataResult.Items[0].Data;
      properties = propertiesResult.Items.reduce(
        (acc, item) =>
          Object.assign(acc, {
            [item.Type]: item.Data
          }),
        {}
      );
      edges = edgesResult.Items.reduce(
        (acc, item) =>
          Object.assign(acc, {
            [item.Type]: nextModel({
              node: item.Target,
              type: item.Type,
              data: item.Data,
              history: [item]
            })
          }),
        {}
      );
      _history = _history.concat([dataResult, propertiesResult, edgesResult]);
      return nextModel({
        history: _history,
        data,
        properties,
        edges
      });
    });
  }
  /**
   * Adds a property to a node.
   * @param {object} config - Configuration object.
   * @property {any} data - Property data.
   * @property {string} type - Connection type.
   * @return {Promise} Next model with the resulting data.
   */
  function addProperty(config = {}) {
    var { type, data } = config;
    var _history = [];
    var start = Promise.resolve();

    if (node === undefined) throw new Error('Node is undefined');
    if (type === undefined) throw new Error('Type is undefined');
    if (data === undefined) throw new Error('Data is undefined');
    if (maxGSIK === undefined) start = getMaxGSIK(_history);

    return start.then(() =>
      db.createProperty({ tenant, node, type, data, maxGSIK }).then(result => {
        _history.push(result);
        return nextModel({ history: _history });
      })
    );
  }
  /**
   * Creates a connection to another node.
   * @param {object} config - Configuration object.
   * @property {string|Model} target - Target node ID, or target node Model.
   * @property {string} type - Connection type.
   * @return {Promise} Next model with the resulting data.
   */
  function connect(config = {}) {
    var { target, type } = config;
    var _history = [];
    var start = Promise.resolve();

    if (isObject(target) && target.node) target = target.node;

    if (node === undefined) throw new Error('Node is undefined');
    if (type === undefined) throw new Error('Type is undefined');
    if (target === undefined) throw new Error('Target is undefined');
    if (maxGSIK === undefined) start = getMaxGSIK(_history);

    return start.then(() =>
      db
        .createEdge({
          tenant,
          type,
          node,
          target,
          maxGSIK
        })
        .then(result => {
          _history.push(result);
          return nextModel({ history: _history });
        })
        .catch(error => {
          history.push(error);
          throw error;
        })
    );
  }
  /**
   * Creates a new node, and all its attached properties.
   * @param {object} config - Configuration object.
   * @property {any} data - Main data stored on the node.
   * @property {Property[]|PropertyMap} properties - Property list, or
   *                                                 PropertyMap to turn into a
   *                                                 Property list, and attach
   *                                                 to the node.
   * @return {Promise} Next model with the resulting data.
   */
  function create(config = {}) {
    var { data, properties } = config;
    var _history = [];
    var _node;

    if (node) throw new Error('Node already exists');
    if (data === undefined) throw new Error('Data is undefined');
    if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');

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
   * @returns {Promise} Next model with the resulting data.
   */
  function promise() {
    return Promise.resolve(status);
  }
  /**
   * Gets the value of the maxGSIK from the table.
   * @returns {Promise} Empty chain to continue the work.
   */
  function getMaxGSIK(history) {
    return db.getNode(node).then(response => {
      var item = response.Items[0];
      maxGSIK = item.MaxGSIK;
      if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');
      history.push(response);
    });
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
        edges,
        data,
        documentClient,
        maxGSIK,
        node,
        properties,
        table,
        type,
        tenant,
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
