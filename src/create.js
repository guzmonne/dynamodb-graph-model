'use strict';

var config = require('./index.js').config();

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
module.exports = function create(doc) {
  console.log(config);

  return Promise.resolve(config);
};
