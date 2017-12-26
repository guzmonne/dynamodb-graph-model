'use strict';

var get = require('./get.js');

/**
 * Looks for nodes on the table. By default it will only return the main node
 * data. To get the properties associated to each node, you must provide them
 * as an array, or you can ask for all of them by providing the key "$all".
 * The same goes for the edges and the edgesLists. But, for now, the query will
 * only return the edges data, and will not recover the properties associated
 * to the edge targets.
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
 *    'Genre',
 *    'Serie'
 *  ],
 *  edges: [
 *    'Author',
 *    'Fans[]'
 *  ]
 * });
 *
 * Book.query({
 *  limit: 3,
 *  properties: ['Genre'],
 *  edges: ['Author'],
 *  edgesList: [{
 *    type: 'Fans',
 *    limit: 3
 *  }]
 * })
 *  .then(result => {
 *    console.log(result);
 *    // [{
 *    //    'id': 'cuix...',
 *    //    'Name': 'Elantris',
 *    //    'Genre': 'Fantasy',
 *    //    'Author': 'cxui...',
 *    //    '@Author': 'Brandon Sanderson',
 *    //    'Fans': {
 *    //      'cxuv...': 'cu12..',  // User 1 Id.
 *    //      '@cxuv...': 'Bob',    // User 1 key data.
 *    //      'cmuv...': 'cu13..',  // User 2 Id.
 *    //      '@cmuv...': 'Alicia', // User 2 key data.
 *    //      'cxuv...': 'cu14...', // User 3 Id.
 *    //      '@cxuv...': 'John',   // User 3 key data.
 *    //    }
 *    //  }, {
 *    //    'id': 'cuiz...',
 *    //    'Name': 'Golden Prey',
 *    //    'Genre': 'Thriller',
 *    //    'Author': 'czui...',
 *    //    '@Author': 'John Sandford',
 *    //    'Fans': {
 *    //      'cxuv...': 'cu22..',  // User 4 Id.
 *    //      '@cxuv...': 'George', // User 4 key data.
 *    //      'cmuv...': 'cu13..',  // User 2 Id.
 *    //      '@cmuv...': 'Alicia', // User 2 key data.
 *    //      'cxuv...': 'cu24...', // User 5 Id.
 *    //      '@cxuv...': 'Betsy',  // User 5 key data.
 *    //    }
 *    //  }, {
 *    //    'id': 'cuiz...',
 *    //    'Name': 'All the Light We Cannot See',
 *    //    'Genre': 'Historical Novel',
 *    //    'Author': 'czui...',
 *    //    '@Author': 'Anthony Doerr',
 *    //    'Fans': {
 *    //      'cxuv...': 'cu32..',  // User 6 Id.
 *    //      '@cxuv...': 'Jim',    // User 6 key data.
 *    //      'cmuv...': 'cu24..',  // User 5 Id.
 *    //      '@cmuv...': 'Betsy',  // User 5 key data.
 *    //      'cxuv...': 'cu35...', // User 7 Id.
 *    //      '@cxuv...': 'Andrew', // User 7 key data.
 *    //    }
 *    // }]
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
 *                       edges to create as a map. The only mandatory key is
 *                       the one that indicates the value of the main node,
 *                       accesed through the <key> value.
 * @return {Promise} Promise that resolves into the newly created Doc.
 */
module.exports = function create(options) {
  var { db, tenant, type, key, maxGSIK } = options;

  if (db === undefined) throw new Error('DB driver is undefined');
  if (type === undefined) throw new Error('Type is undefined');
  if (key === undefined) throw new Error('Key is undefined');
  if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');

  var get$ = get(options);

  return doc => {};
};
