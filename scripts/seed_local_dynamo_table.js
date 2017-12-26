'use strict';

var AWS = require('aws-sdk');
var cuid = require('cuid');
var csv = require('csvtojson');
var path = require('path');
var Rx = require('rxjs/Rx');
var chalk = require('chalk');
var omitBy = require('lodash/omitBy.js');
var isEmpty = require('lodash/isEmpty.js');
var isUndefined = require('lodash/isUndefined.js');
var GraphModel = require('../src/Model.js');

var endpoint = 'http://localhost:8989';

/** Constants */
var CHARACTERS_FILE = './the-simpsons-by-the-data/simpsons_characters.csv';
var LOCATIONS_FILE = './the-simpsons-by-the-data/simpsons_locations.csv';
var EPISODES_FILE = './the-simpsons-by-the-data/simpsons_episodes.csv';
var SCRIPT_LINE_FILE = './the-simpsons-by-the-data/simpsons_script_lines.csv';
var SEASONS_FILE = './the-simpsons-by-the-data/simpsons_seasons.csv';
var RATINGS_FILE = './the-simpsons-by-the-data/simpsons_ratings.csv';
var VIEWERS_FILE = './the-simpsons-by-the-data/simpsons_viewers.csv';
var VIEWS_FILE = './the-simpsons-by-the-data/simpsons_views.csv';
var VOTES_FILE = './the-simpsons-by-the-data/simpsons_votes.csv';
var TABLE_NAME = 'GraphTable';
var TENANT = 'simpsons';
var INTERVAL = 1;
/** ********* */

/** AWS configuration */
AWS.config.update({ region: 'us-east-1' });
var DynamoDB = new AWS.DynamoDB({ endpoint });
var documentClient = new AWS.DynamoDB.DocumentClient({
  service: DynamoDB
});
/** ***************** */

/** Model configuration */
GraphModel.config({
  table: TABLE_NAME,
  documentClient,
  maxGSIK: 10,
  tenant: TENANT,
  nodeGenerator
});

var Character = GraphModel({
  type: 'character',
  key: 'name',
  properties: ['gender']
});

var Location = GraphModel({
  type: 'location',
  key: 'name'
});

var Season = GraphModel({
  type: 'season',
  key: 'number',
  nodeGenerator: ({ number }) => `season#${number}`
});

var Rating = GraphModel({
  type: 'rating',
  key: 'value',
  nodeGenerator: ({ value }) => `rating#${value}`
});

var Votes = GraphModel({
  type: 'votes',
  key: 'number',
  nodeGenerator: ({ number }) => `votes#${number}`
});

var Viewers = GraphModel({
  type: 'viewers',
  key: 'number',
  nodeGenerator: ({ number }) => `viewers#${number}`
});

var Views = GraphModel({
  type: 'views',
  key: 'number',
  nodeGenerator: ({ number }) => `views#${number}`
});

var Episode = GraphModel({
  type: 'episode',
  key: 'title',
  properties: [
    'number_in_season',
    'number_in_series',
    'image_url',
    'video_url'
  ],
  edges: [
    'season',
    'us_viewers_in_millions',
    'views',
    'imdb_rating',
    'imdb_votes'
  ]
});
/** ******************* */

/** Main */
DynamoDB.listTables({})
  .promise()
  .then(checkTable)
  .then(createTable)
  .then(loadData)
  .then(result => console.log('The result is:', result))
  .catch(error => {
    console.log(error);
  });
/******* */

/** Functions */
function nodeGenerator(doc) {
  var type = doc.__type;
  var id = doc.id;
  return `${type + '#' || ''}${id}`;
}

function checkTable(result) {
  return result.TableNames.indexOf(TABLE_NAME) === -1;
}

function loadData() {
  return Promise.all([
    loadFile(CHARACTERS_FILE, Character),
    loadFile(LOCATIONS_FILE, Location),
    loadFile(SEASONS_FILE, Season),
    loadFile(VIEWERS_FILE, Viewers),
    loadFile(VIEWS_FILE, Views),
    loadFile(VOTES_FILE, Votes),
    loadFile(RATINGS_FILE, Rating)
  ]).then(() => Promise.all([loadFile(EPISODES_FILE, Episode)]));
}

function loadFile(file, model) {
  return new Promise((resolve, reject) => {
    var data = [];
    csv()
      .fromFile(path.resolve(__dirname, file))
      .on('json', row => data.push(row))
      .on('done', (error, json) => {
        if (error) reject(error);

        var data$ = Rx.Observable.from(data);
        var interval$ = Rx.Observable.interval(INTERVAL).take(data.length);

        Rx.Observable.zip(data$, interval$)
          .mergeMap(([item]) => {
            item.__type = model.type;

            if (item.value) item.value = +item.value;

            if (item.number) item.number = +item.number;

            if (model.type === 'episode') {
              if (!isUndefined(item.season) && !isEmpty(item.season))
                item.season = `${TENANT}#season#${item.season}`;
              if (
                !isUndefined(item.us_viewers_in_millions) &&
                !isEmpty(item.us_viewers_in_millions)
              )
                item.us_viewers_in_millions = `${TENANT}#viewers#${
                  item.us_viewers_in_millions
                }`;
              if (!isUndefined(item.views) && !isEmpty(item.views))
                item.views = `${TENANT}#views#${item.views}`;
              if (!isUndefined(item.imdb_rating) && !isEmpty(item.imdb_rating))
                item.imdb_rating = `${TENANT}#rating#${item.imdb_rating}`;
              if (!isUndefined(item.imdb_votes) && !isEmpty(item.imdb_votes))
                item.imdb_votes = `${TENANT}#votes#${item.imdb_votes}`;
            }

            return model.create(omitBy(item, v => v === undefined || v === ''));
          })
          //.do(x => blue(JSON.stringify(x, null, 2)))
          .catch(error => {
            red(error.name);
            red(error.message);
            red(error.stack);
            return Rx.Observable.of(error);
          })
          .reduce((acc, item) => acc.concat(item), [])
          .subscribe({
            error: error => reject(error),
            complete: () => {
              green(`${model.type} loading complete.`);
              resolve();
            }
          });
      });
  });
}

function red(v) {
  console.log.bind(console)(chalk.red(v));
}

function green(v) {
  console.log.bind(console)(chalk.green(v));
}

function blue(v) {
  console.log.bind(console)(chalk.blue(v));
}

function deleteData(doc) {
  console.log(doc);
  return Character.destroy(doc);
}

function createTable(tableExists) {
  if (tableExists === true) {
    return DynamoDB.createTable({
      AttributeDefinitions: [
        {
          AttributeName: 'Node',
          AttributeType: 'S'
        },
        {
          AttributeName: 'Type',
          AttributeType: 'S'
        },
        {
          AttributeName: 'Data',
          AttributeType: 'S'
        },
        {
          AttributeName: 'GSIK',
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'Node',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'Type',
          KeyType: 'RANGE'
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      TableName: TABLE_NAME,
      GlobalSecondaryIndexes: [
        {
          IndexName: 'ByType',
          KeySchema: [
            {
              AttributeName: 'GSIK',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'Type',
              KeyType: 'RANGE'
            }
          ],
          Projection: {
            NonKeyAttributes: ['Data', 'Target', 'Node'],
            ProjectionType: 'INCLUDE'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        },
        {
          IndexName: 'ByData',
          KeySchema: [
            {
              AttributeName: 'GSIK',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'Data',
              KeyType: 'RANGE'
            }
          ],
          Projection: {
            NonKeyAttributes: ['Type', 'Target', 'Node'],
            ProjectionType: 'INCLUDE'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ]
    })
      .promise()
      .then(response => {
        console.log('Table created.');
        console.log(JSON.stringify(response, null, 2));
      });
  }
  return Promise.resolve();
}
/************ */
