'use strict';

var cuid = require('cuid');

/**
 * Removes a node, its properties, and all its edges.
 * For it to work, the model must first be configured with the table,
 * DynamoDB Document Client object, and maxGSIK value.
 *
 * Ex.
 *
 * Model.config({
 *  table: process.env.TABLE_NAME,
 *  documentClient: new AWS.DynamoDB.DocumentClient(),
 *  maxGSIK: 4
 * });
 *
 * // Book model configuration.
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
 * // ...
 *
 * var book = {
 *   'Name': 'Elantris',
 *   'Genre': 'Fantasy'
 *   'Author': 'cxui..',
 *   '@Author': 'Brandon Sanderson',
 *   'Likes': [{
 *     'User': 'cxuv...',
 *     '@User': 'Bob'
 *   }, {
 *     'User': 'cxud...',
 *     '@User': 'Alice'
 *   }]
 * }
 *
 * Book.delete(book.id)
 *  .then(result => {
 *    console.log(result);
 *    // undefined
 *  })
 *
 * @param {object} options - Function configuration options.
 * @property {DynamoDBGraphDriver} db - DynamoDB Graph driver.
 * @return {function} Configured create function.
 * @param {string} node - Node ID to delete.
 * @return {Promise} Promise that resolves into the newly created Doc.
 */
module.exports = function destroy(options) {
  var { db } = options;

  if (db === undefined) throw new Error('DB driver is undefined');

  return doc => {
    var node = doc.id;

    if (node === undefined) throw new Error('ID is undefined');

    return db.deleteNode(node);
  };
};
