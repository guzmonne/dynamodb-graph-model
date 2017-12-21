'use strict';

var cuid = require('cuid');

/**
 * Takes in a document object, and creates the node, properties, and edges
 * on the DynamoDB Graph table. Then it returns the created object as a doc
 * back to the client.
 * For it to work, the model must first be configured with the table,
 * DynamoDB Document Client object, and maxGSIK value.
 * @param {object} doc
 * @property {string|number} <key> - It must include the configures key value.
 * @property {any} <properties> - Any of the defined properties.
 * @property {string|number|lists} <edges> - Any of the defined edges.
 * @return {Promise} Promise that resolves into the newly created Doc.
 * Ex.
 * Model.config({
 *  table: process.env.TABLE_NAME,
 *  documentClient: new AWS.DynamoDB.DocumentClient(),
 *  maxGSIK: 4
 * });
 *
 * var Book = new Model({
 *  tenant: cuid(),
 *  type: 'Book',
 *  key: 'Name',
 *  properties: [
 *    'Genre'
 *  ],
 *  edges: [
 *    'Author',
 *    'Likes[]'
 *  ]
 * });
 *
 * Book.create({
 *  Name: 'Elantris',
 *  Genre: 'Fantasy',
 *  Author: author,
 *  Likes: [
 *    User1,
 *    User2
 *  ]
 * })
 *  .then(result => {
 *    console.log(result);
 *    // {
 *    //    'Name': 'Elantris',
 *    //    'Genre': 'Fantasy'
 *    //    'Author': 'cxui..',
 *    //    '@Author': 'Brandon Sanderson',
 *    //    'Likes': [{
 *    //      'User': 'cxuv...',
 *    //      '@User': 'Bob'
 *    //    }, {
 *    //      'User': 'cxud...',
 *    //      '@User': 'Alice'
 *    //    }]
 *    // }
 *  })
 */
module.exports = function create(options) {
  var { db, tenant, type, key, maxGSIK, properties = [], edges = [] } = options;

  if (db === undefined) throw new Error('DB driver is undefined');
  if (type === undefined) throw new Error('Type is undefined');
  if (key === undefined) throw new Error('Key is undefined');
  if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');

  return doc => {
    var data = doc[key];
    var node = cuid();

    if (data === undefined) throw new Error('Data is undefined');

    return db
      .createNode({
        node,
        tenant,
        type,
        data,
        maxGSIK
      })
      .then(result => {
        var promises = [Promise.resolve()];

        var propMap = properties
          .filter(property => doc[property] !== undefined)
          .map(property => ({
            type: property,
            data: doc[property]
          }));

        var edgeMap = edges
          .filter(edge => doc[edge] !== undefined)
          .map(edge => ({
            type: edge,
            target: doc[edge]
          }));

        if (propMap.length > 0)
          propMap.forEach(({ type, data }) =>
            promises.push(
              db.createProperty({
                tenant,
                type,
                node,
                data,
                maxGSIK
              })
            )
          );

        if (edgeMap.length > 0)
          edgeMap.forEach(edge => {
            var { type, target } = edge;
            return promises.push(
              db
                .createEdge({
                  tenant,
                  type,
                  node,
                  target,
                  maxGSIK
                })
                .then(response => (edge.data = response.Item.Data))
            );
          });

        return Promise.all(promises).then(result => {
          return Object.assign(
            {
              id: node,
              [key]: data
            },
            doc,
            edgeMap.reduce(
              (acc, edge) =>
                Object.assign({}, acc, {
                  [`@${edge.type}`]: edge.data
                }),
              {}
            )
          );
        });
      });
  };
};

/**
 * EdgeItem configuration object.
 * @typedef {Object} PropertyItemConfig
 * @property {string} tenant='' - Identifier of the current tenant.
 * @property {string} type - Node type.
 * @property {any}    data - Main data of the node. Will be encoded so it
 *                           maintains its type even though it is stored as
 *                           a string.
 * @property {string} node - Existing node reference. Will be created if it
 *                           is not provided.
 * @property {number} [maxGSIK=4] - Maximum GSIK value to add on the node.
 */

/*
 * NodeItem configuration object.
 * @typedef {Object} NodeItemConfig
 * @property {string} tenant='' - Identifier of the current tenant.
 * @property {string} type - Node type.
 * @property {any}    data - Main data of the node. Will be encoded so it
 *                           maintains its type even though it is stored as
 *                           a string.
 * @property {string} [node] - Existing node reference. Will be created if it
 *                             is not provided.
 * @property {number} [maxGSIK=4] - Maximum GSIK value to add on the node.
 */
