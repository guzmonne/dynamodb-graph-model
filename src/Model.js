'use strict';

var cuid = require('cuid');
var pick = require('lodash/pick');
var isObject = require('lodash/isObject.js');
var isFunction = require('lodash/isFunction.js');
var create = require('./create.js');
var update = require('./update.js');
var destroy = require('./destroy.js');
var get = require('./get.js');

var optionKeys = [
  'db',
  'maxGSIK',
  'tenant',
  'documentClient',
  'table',
  'key',
  'nodeGenerator'
];

var defaults = {};

module.exports = Model;

// ---

function Model(options = {}) {
  options = Object.assign({}, defaults, options);

  var {
    table = process.env.TABLE_NAME,
    documentClient,
    maxGSIK,
    key
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

  /** Node Generator setup */
  isFunction(options.nodeGenerator) || (options.nodeGenerator = cuid);

  return Object.freeze({
    create: create(options),
    update: update(options),
    destroy: destroy(options),
    get: get(options),
    type: options.type
  });
}

Model.config = function(options) {
  if (isObject(options)) {
    defaults = Object.assign({}, defaults, pick(options, optionKeys));
  }

  return Object.assign({}, defaults);
};
