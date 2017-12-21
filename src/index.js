'use strict';

var pick = require('lodash/pick');
var isObject = require('lodash/isObject.js');

var optionKeys = ['db', 'maxGSIK', 'tenant', 'documentClient', 'table'];

var defaults = {
  db: undefined,
  maxGSIK: undefined,
  tenant: undefined,
  documentClient: undefined,
  table: undefined
};

module.exports = Model;

// ---

function Model(options = {}) {
  var {
    table = defaults.table || process.env.TABLE_NAME,
    documentClient = defaults.documentClient,
    maxGSIK = defaults.maxGSIK
  } = options;

  if (table === undefined) throw new Error('Table is undefined');
  if (documentClient === undefined)
    throw new Error('DynamoDB Document Client is undefined');
  if (maxGSIK === undefined) throw new Error('Max GSIK is undefined');

  return Object.freeze({});
}

Model.config = function(options) {
  if (isObject(options)) {
    defaults = Object.assign({}, defaults, pick(options, optionKeys));
  }

  return Object.assign({}, defaults);
};
