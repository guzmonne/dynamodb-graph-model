'use strict';

var pick = require('lodash/pick');
var isObject = require('lodash/isObject.js');
var create = require('./create.js');
var update = require('./update.js');
var destroy = require('./destroy.js');

var optionKeys = ['db', 'maxGSIK', 'tenant', 'documentClient', 'table', 'key'];

var defaults = {};

module.exports = Model;

// ---

function Model(options = {}) {
  var {
    table = defaults.table || process.env.TABLE_NAME,
    documentClient = defaults.documentClient,
    maxGSIK = defaults.maxGSIK,
    key = defaults.key
  } = options;

  if (table === undefined) throw new Error('Table is undefined');
  if (documentClient === undefined)
    throw new Error('DynamoDB Document Client is undefined');
  if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');
  if (key === undefined) throw new Error('Key is undefined');

  /** DynamoDB driver configuration */
  isObject(options.db) ||
    (options.db = require('dynamodb-graph')({
      db: documentClient,
      table: table
    }));

  return Object.freeze({
    create: create(options),
    update: update(options),
    destroy: destroy(options)
  });
}

Model.config = function(options) {
  if (isObject(options)) {
    defaults = Object.assign({}, defaults, pick(options, optionKeys));
  }

  return Object.assign({}, defaults);
};
