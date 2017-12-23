'use strict';

/**
 * Looks for a node on the table. By default, it will only return the main
 * node data. To get its properties, you can ask for the specific proprties,
 * or you may ask for all of them, using the "$all" keyword.
 * The function can also retrieve edges. One-to-one edges are asked by `type`,
 * while list edges must be asked for following a query.
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
 * Book.get({
 *  id: 'cuix...',
 *  properties: '$all',
 *  edges: ['Author'],
 *  edgesList: [{
 *    type: 'Fans',
 *    limit: 3,
 *  }]
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
 *    //      'cxuv...': 'cu12..',  // User 1 Id.
 *    //      '@cxuv...': 'Bob',    // User 1 key data.
 *    //      'cmuv...': 'cu13..',  // User 2 Id.
 *    //      '@cmuv...': 'Alicia', // User 2 key data.
 *    //      'cxuv...': 'cu14...', // User 3 Id.
 *    //      '@cxuv...': 'John',   // User 3 key data.
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

  return doc => {
    var { id: node, properties = [], edges = [], edgesList = [] } = doc;

    if (doc.properties === '$all') properties = options.properties;
    if (doc.edges === '$all')
      edges = options.edges.filter(edge => edge.indexOf('[]') === -1);

    return Promise.all([
      db.getNode(node),
      Promise.all(
        properties
          .filter(property => options.properties.indexOf(property) > -1)
          .map(property =>
            db.getNodeType({
              node,
              type: property
            })
          )
      ),
      Promise.all(
        edges.filter(edge => options.edges.indexOf(edge) > -1).map(edge =>
          db.getNodeType({
            node,
            type: edge
          })
        )
      ),
      Promise.all(
        edgesList
          .filter(edgeList => options.edges.indexOf(`${edgeList.type}[]`) > -1)
          .map(edgeList =>
            db
              .getNodeTypes({
                node,
                limit: typeof edgeList.limit === 'number' ? edgeList.limit : 10,
                sortKeyCondition: 'begins_with(#Type, :Value)',
                sortKeyValue:
                  typeof edgeList.beginsWith === 'string'
                    ? edgeList.type + '#' + edgeList.beginsWith
                    : edgeList.type
              })
              .then(response => {
                response.Type = edgeList.type;
                return response;
              })
          )
      )
    ]).then(results => {
      var [
        nodeResult,
        propertiesResults,
        edgesResults,
        edgeListResults
      ] = results;

      return Object.assign(
        {
          id: node,
          [key]: nodeResult.Item.Data
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
        edgeListResults.reduce((acc1, result) => {
          return Object.assign(acc1, {
            [result.Type]: result.Items.reduce((acc2, item) => {
              let id = item.Type.split('#')[1];
              return Object.assign(acc2, {
                [id]: item.Target,
                [`@${id}`]: item.Data
              });
            }, {})
          });
        }, {})
      );
    });
  };
};
