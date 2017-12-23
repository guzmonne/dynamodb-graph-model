'use strict';

var cuid = require('cuid');

/**
 * Takes in a document object, and creates the node, properties, and edges
 * on the DynamoDB Graph table. Then it returns the created object as a doc
 * back to the client.
 * For it to work, the model must first be configured with the table,
 * DynamoDB Document Client object, and maxGSIK value.
 *
 * Ex.
 * Model.config({
 *  table: process.env.TABLE_NAME,
 *  documentClient: new AWS.DynamoDB.DocumentClient(),
 *  maxGSIK: 10
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
 *    'Fans[]'
 *  ]
 * });
 *
 * Book.create({
 *  Name: 'Elantris',
 *  Genre: 'Fantasy',
 *  Author: author,
 *  Fans: [
 *    'cu12...', // User 1 Id.
 *    'cu13...', // User 2 Id.
 *  ]
 * })
 *  .then(result => {
 *    console.log(result);
 *    // {
 *    //    'id': 'cuix...',
 *    //    'Name': 'Elantris',
 *    //    'Genre': 'Fantasy'
 *    //    'Author': 'cxui..',
 *    //    '@Author': 'Brandon Sanderson',
 *    //    'Fans': {
 *    //      'cxuv...': 'cu12...', // User 1 Id.
 *    //      '@cxuv...': 'Bob', // User 1 key data.
 *    //      'cmuv...': 'cu13...', // User 2 Id.
 *    //      '@cmuv...': 'Alicia', // User 2 key data.
 *    //    }
 *    // }
 *  })
 *
 *  // Later...
 *
 *  Book.update({
 *    id: 'cuix...',
 *    ReleaseData: '21/05/2005',
 *    Fans: [
 *      'cu14...', // User 3 Id.
 *      'cu15...', // User 4 Id.
 *    ]
 *  })
 *  .then(doc => {
 *    console.log(doc);
 *    // {
 *    //    id: 'cuix...',
 *    //    Fans: {
 *    //      'cxuv...': 'cu14...', // User 3 Id.
 *    //      '@cxuv...': 'John',   // User 3 key data.
 *    //      'cmuv...': 'cu15...', // User 4 Id.
 *    //      '@cmuv...': 'Jane',   // User 4 key data.
 *    //    }
 *    // }
 *  })
 *
 * @param {object} options - Function configuration options.
 * @property {DynamoDBGraphDriver} db - DynamoDB Graph driver.
 * @property {edges[]} [edges] - List of strings that represent edges.
 * @property {string} key - Node data key name.
 * @property {number} maxGSIK - Maximum GSIK partitions.
 * @property {property[]} [properties] - List of strings that represent
 *                                       properties.
 * @property {string} [tenant] - Current tenant ID.
 * @property {string} type - Node type.
 * @return {function} Configured create function.
 * @param {object} doc - JavaScript object cotainging the node, properties, and
 *                       edges to update as a map. The only mandatory key is the
 *                       `id`, which identifies the node were the changes would
 *                       be applied.
 * @return {Promise} Promise that resolves into the newly created Doc.
 */
module.exports = function update(options) {
  var { db, tenant, maxGSIK, properties = [], edges = [] } = options;

  if (db === undefined) throw new Error('DB driver is undefined');
  if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');

  return doc => {
    var node = doc.id;

    if (node === undefined) throw new Error('Id is undefined');

    return Promise.all([
      Promise.all(
        properties
          .filter(property => doc[property] !== undefined)
          .map(property =>
            db.createProperty({
              tenant,
              type: property,
              node,
              data: doc[property],
              maxGSIK
            })
          )
      ),
      Promise.all(
        edges.filter(edge => doc[edge] !== undefined).map(edge =>
          db.createEdge({
            tenant,
            type: edge,
            node,
            target: doc[edge],
            maxGSIK
          })
        )
      ),
      Promise.all(
        edges
          .filter(edge => edge.indexOf(['[]']) > -1)
          .map(edge => edge.replace('[]', ''))
          .filter(edge => doc[edge] !== undefined)
          .map(edge =>
            Promise.all(
              doc[edge].map(target =>
                db.createEdge({
                  tenant,
                  type: `${edge}#${cuid()}`,
                  node,
                  target: target,
                  maxGSIK
                })
              )
            )
          )
      )
    ]).then(results => {
      var [propertiesResults, edgesResults, edgeListResults] = results;
      return Object.assign(
        {
          id: node
        },
        propertiesResults.reduce(
          (acc, result) =>
            Object.assign(acc, {
              [result.Item.Type]: result.Item.Data
            }),
          {}
        ),
        edgesResults.reduce(
          (acc, result) =>
            Object.assign(acc, {
              [result.Item.Type]: result.Item.Target,
              [`@${result.Item.Type}`]: result.Item.Data
            }),
          {}
        ),
        edgeListResults
          .map(results => {
            var type = results[0].Item.Type.split('#')[0];
            return {
              [type]: results.reduce((acc, result) => {
                let id = result.Item.Type.split('#')[1];
                return Object.assign(acc, {
                  [id]: result.Item.Target,
                  [`@${id}`]: result.Item.Data
                });
              }, {})
            };
          })
          .reduce((acc, results) => Object.assign(acc, results), {})
      );
    });
  };
};
