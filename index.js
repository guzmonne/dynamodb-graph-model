'use strict';

var cuid = require('cuid');
var omit = require('lodash/omit.js');
var isObject = require('lodash/isObject.js');
var isArray = require('lodash/isArray.js');

/**
 * Factory functions that returns a model, than can talk to a DynamoDB table
 * that is used to represent a directed graph.
 * @param {object} options
 * @property {any} [data] - Node main data.
 * @property {DynamoDBGraph} [db] - DynamoDB Graph object. Useful for testing.
 * @property {DocumentClientDriver} [documentClient] - DynamoDB DocumentClient
 *                                                     driver.
 * @property {EdgesMap} [edges]=[] - Map of node edges.
 * @property {object[]} [history]=[] - History of the model.
 * @property {number} [maxGSIK] - Maximum number of GSIK.
 * @property {string} [node] - Node of the current model.
 * @property {boolean} [log] - If set, all updates will include a CreatedAt or
 *                             UpdatedAt property generated along them.
 * @property {PropertyMap} [properties]=[] - Map of node properties.
 * @property {string} [table] - Table name. If not provided, it will try to pull
 *                              it from an environment variable called
 *                              TABLE_NAME.
 * @property {string} [tenant=''] - Tenant identifier.
 * @property {string} type - Node type.
 */
module.exports = function Model(options = {}) {
  var {
    data,
    db,
    documentClient,
    edges = [],
    history = [],
    maxGSIK,
    node,
    log = false,
    properties = [],
    table = process.env.TABLE_NAME,
    tenant = '',
    type
  } = options;

  if (type === undefined) throw new Error('Type is undefined');
  if (maxGSIK !== undefined && typeof maxGSIK !== 'number')
    throw new Error('Max GSIK is not a number');
  if (table === undefined) throw new Error('Table is undefined');

  if (db === undefined && documentClient === undefined) {
    var AWS = require('aws-sdk');
    documentClient = new AWS.DynamoDB.DocumentClient();
  }
  /** DynamoDB driver configuration */
  db ||
    (db = require('dynamodb-graph')({
      db: documentClient,
      table: table
    }));

  /** Return */
  var publicAPI = {
    add,
    create,
    connect,
    collection,
    get data() {
      return data;
    },
    destroy,
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
    get properties() {
      return properties;
    },
    set,
    _documentClient: documentClient
  };

  return publicAPI;
  // ---
  function collection() {
    return db
      .getNodesWithPropertiesAndEdges({ type, tenant, maxGSIK })
      .then(response =>
        response.Items.map(item =>
          newModel({
            node: item.Node,
            data: item.Data,
            properties: item.Properties,
            edges: item.Edges
          })
        )
      );
  }
  /**
   * Sets the new node, and returns the other values to its default.
   * @param {string} newNode - New node ID.
   * @param {Model} Returns a new Model with the new node.
   */
  function set(newNode) {
    history.push({ set: newNode });
    return Promise.resolve(
      newModel({
        node: newNode,
        data: undefined,
        properties: {},
        edges: {}
      })
    );
  }
  /**
   * Gets the node data, properties, and edge information.
   * @return {Promise} Next model with the resulting data.
   */
  function get() {
    var data, properties, edges;

    var track = createTracker();

    if (node === undefined) throw new Error('Node is undefined');

    return Promise.all([
      db.getNodeData(node),
      db.getNodeProperties(node),
      db.getNodeEdges(node)
    ])
      .then(results => {
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
              [item.Type]: newModel({
                node: item.Target,
                type: item.Type,
                data: item.Data,
                history: [item]
              })
            }),
          {}
        );

        track(dataResult, propertiesResult, edgesResult);

        return newModel({
          history: track.dump(),
          data,
          properties,
          edges
        });
      })
      .catch(error => {
        track(error);
        throw error;
      });
  }
  /**
   * Adds a property on a node.
   * @param {object} config - Configuration object.
   * @property {any} data - Property data.
   * @property {string} type - Connection type.
   * @return {Promise} Next model with the resulting data.
   */
  function add(config = {}) {
    var { type, data } = config;
    var track = createTracker();
    var start = Promise.resolve();

    if (node === undefined) throw new Error('Node is undefined');
    if (type === undefined) throw new Error('Type is undefined');
    if (data === undefined) throw new Error('Data is undefined');
    if (maxGSIK === undefined)
      start = getMaxGSIK().then(response => track(response));

    return start.then(() =>
      db
        .createProperty({ tenant, node, type, data, maxGSIK })
        .then(result => {
          track(result);
          return newModel({ history: track.dump() });
        })
        .catch(error => {
          track(error);
          throw error;
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
    var track = createTracker();
    var start = Promise.resolve();

    if (isObject(target) && target.node) target = target.node;

    if (node === undefined) throw new Error('Node is undefined');
    if (type === undefined) throw new Error('Type is undefined');
    if (target === undefined) throw new Error('Target is undefined');
    if (maxGSIK === undefined)
      start = getMaxGSIK().then(response => track(response));

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
          track(result);
          return newModel({
            edges: edges.concat(result.Item),
            history: track.dump()
          });
        })
        .catch(error => {
          track(error);
          throw error;
        })
    );
  }
  /**
   * Creates a new node, with its properties and edges.
   * @param {object} config - Configuration object.
   * @property {any} data - Main data stored on the node.
   * @property {Edge[]} - Edges list to attach on the node.
   * @property {Property[]} properties - Property list to attach on the node.
   * @return {Promise} Next model with the resulting data.
   */
  function create(config = {}) {
    var { data, properties = [], edges = [] } = config;
    var track = createTracker();
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

        track(response);

        if (log === true) {
          var now = Date.now();
          properties = properties.concat([
            { Type: 'CreatedAt', Data: now },
            { Type: 'UpdatedAt', Data: now }
          ]);
        }

        var promises = [];

        if (properties.length > 1)
          promises.push(
            db
              .createProperties({
                tenant,
                node: _node,
                maxGSIK,
                properties
              })
              .then(response => {
                track(response);
              })
          );

        if (edges.length > 1)
          promises.push(
            db
              .createEdges({
                tenant,
                node: _node,
                maxGSIK,
                edges
              })
              .then(response => {
                track(response);
              })
          );

        return promises.length > 0 && Promise.all(promises);
      })
      .then(() => {
        return newModel({
          node: _node,
          data,
          properties,
          edges,
          history: track.dump()
        });
      })
      .catch(error => {
        track(error);
        throw error;
      });
  }
  /**
   * Destroys a node, and all its attached properties and edges.
   * @param {string}  - Configuration object.
   * @return {Promise} Next model with the resulting data.
   */
  function destroy() {
    if (node === undefined) throw new Error('Node is undefined');

    var track = createTracker();

    return db
      .deleteNode(node)
      .then(response => {
        track(response);
        return newModel({
          node: undefined,
          data: undefined,
          properties: [],
          edges: [],
          history: track.dump()
        });
      })
      .catch(error => {
        track(error);
        throw error;
      });
  }
  /**
   * Gets the value of the maxGSIK from the table.
   * @returns {Promise} Empty chain to continue the work.
   */
  function getMaxGSIK() {
    return db
      .getNode(node)
      .then(response => {
        var item = response.Items[0];
        maxGSIK = item.MaxGSIK;
        if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');
        return response;
      })
      .catch(error => {
        track(error);
        throw error;
      });
  }
  /**
   * Returns a new Model based on the current one with some overrided
   * properties.
   * @param {object} override - Model attributes override object.
   */
  function newModel(override) {
    return Model(Object.assign({}, options, override));
  }
  /**
   * Tracks all the actions performed on the model, and returns a function
   * that can be called to return only the ones captured by the current
   * tracker.
   * @param {boolean} mutate - Flag to indicate if the history should be stored
   *                           on the current one or on the next.
   * @returns {function} A function that keeps tracks of events.
   * @property {function} dump - Returns the currently tracked history.
   */
  function createTracker() {
    var _history = [];

    function track(args) {
      history = history.concat(args);
      _history = _history.concat(args);
    }

    track.dump = () => _history.slice();

    return track;
  }
};

/**
 * Edge object to attach on a node.
 * @typedef {Object} Edge
 * @property {string} type - Edge type.
 * @property {string} target - Target node.
 * @property {any} data - Edge data.
 *
 * Property object to attach on a node.
 * @typedef {Object} Property
 * @property {string} type - Property type.
 * @property {any} data - Value of the property.
 *
 */
