# DynamoDB Graph Model

This is a library aimed to work with DynamoDB as if it was a Graph. The idea
came from the "Advanced Design Patterns for Amazon DynamoDB (DAT403-R)" talk
from Rick Houlihan on 2017 AWS re:Invent conference. Close to the end he
describes a way to use a DynamoDB table to represent a graph. I found that idea
very interesting, so I wanted to create a library that would let me interact
with that kind of table structure. I added only two things to the pattern
presented on this talk:

1. The concept of a `tenant`.
2. A way to handle the amount of GSI partitions to use.

So, each node can belong to a `tenant` by concatenating the random ID of the
node (a `cuid` in this case), with the `tenant` id (also a CUID). The GSI Keys
are also prepended with the tenant ID, so that you can check for the data only
in the proper GSI partitions.

To control the number of GSI Keys you can use the `maxGSIK` option.

This library is constructed on top of anther library, which is in charge of
handling the communication with DynamoDB. When instantiating a new Model, you
can provide a DynamoDB DocumentClient driver, or, just let it instantiate one
for you. This will work, provided you have configured the AWS SDK correctly.
Having the ability to pass your own driver, simplifies the way the library can
be tested.

## DynamoDB Table

As mentioned before the `dynamodb-graph` library is used to interact with the
DynamoDB table, which must have a schema similar to this.

````yaml
## DynamoDB table.

The schema for the DynamoDB table, written as a CloudFormation template is the
following:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Graph:
    Type: "AWS::DynamoDB::Table"
    Properties:
      AttributeDefinitions:
        -
          AttributeName: "Node"
          AttributeType: "S"
        -
          AttributeName: "Type"
          AttributeType: "S"
        -
          AttributeName: "Data"
          AttributeType: "S"
        -
          AttributeName: "GSIK"
          AttributeType: "S"
      KeySchema:
        -
          AttributeName: "Node"
          KeyType: "HASH"
        -
          AttributeName: "Type"
          KeyType: "RANGE"
      ProvisionedThroughput:
        ReadCapacityUnits: "1"
        WriteCapacityUnits: "1"
      TableName: "GraphExample"
      GlobalSecondaryIndexes:
        -
          IndexName: "ByType"
          KeySchema:
            -
              AttributeName: "GSIK"
              KeyType: "HASH"
            -
              AttributeName: "Type"
              KeyType: "RANGE"
          Projection:
            NonKeyAttributes:
              - "Data"
              - "Target"
              - "MetaData"
            ProjectionType: "INCLUDE"
          ProvisionedThroughput:
            ReadCapacityUnits: "2"
            WriteCapacityUnits: "2"
        -
          IndexName: "ByData"
          KeySchema:
            -
              AttributeName: "GSIK"
              KeyType: "HASH"
            -
              AttributeName: "Data"
              KeyType: "RANGE"
          Projection:
            NonKeyAttributes:
              - "Type"
              - "Target"
              - "MetaData"
            ProjectionType: "INCLUDE"
          ProvisionedThroughput:
            ReadCapacityUnits: "2"
            WriteCapacityUnits: "2"
````

As you can see from the CloudFormation template, the table needs to use the
`Node` as the hash key, and the `Type` as the sort key. The table also must
include two GSI, one indexed by `GSIK` and `Type`, and the other by `GSIK` and
`Data`. They should be named `ByType`, and `ByData` respectively.

The GSI keys are created by `dynamodb-graph`, combining the node id, tenant id,
and the `maxGSIK` value. This way you can provision few GSIK partitions at the
beginning and grow them further along. Take into account that the `maxGSIK`
**should never be decreased**. Doing so will make some nodes unavailable.

## Getting Started

Install the library on your project using `npm` or `yarn`.

```
npm install --save dynamodb-graph-model

yarn install dynamodb-graph-model
```

Then you can import it to your project using `require`. To interact with a
model you must fist configure it, by passing some required and optional
values. Here is the JSDoc that defines the types of all the options.

```javascript
/**
 * Factory functions that returns a model, than can talk to a DynamoDB table
 * that is used to represent a directed graph.
 * @param {object} options
 * @property {any} [data] - Node main data.
 * @property {DynamoDBGraph} [db] - DynamoDB Graph object. Useful for testing.
 * @property {DocumentClientDriver} [documentClient] - DynamoDB DocumentClient
 *                                                     driver.
 * @property {EdgesMap} [edges]=[] - Map of node edges.
 * @property {object[]} [history]=[] - History of the model.
 * @property {number} [maxGSIK] - Maximum number of GSIK.
 * @property {string} [node] - Node of the current model.
 * @property {boolean} [log] - If set, all updates will include a CreatedAt or
 *                             UpdatedAt property generated along them.
 * @property {PropertyMap} [properties]=[] - Map of node properties.
 * @property {string} [table] - Table name. If not provided, it will try to pull
 *                              it from an environment variable called
 *                              TABLE_NAME.
 * @property {string} [tenant=''] - Tenant identifier.
 * @property {string} type - Node type.
 */
```

The table name can also be taken from an environment table called `TABLE_NAME`.

Here is an example of how to instantiate a new `Model`.

```javascript
var AWS = require('aws-sdk');
var Model = require('dynamodb-graph-model');

// Configure the AWS SDK however you like.
AWS.config.update({ region: 'us-east-1' });

// On this example, we will provide our own DynamoDB Document Client driver.
var documentClient = new AWS.DynamoDB.DocumentClient();

// The table can be passed in as a parameter or stored inside the TABLE_NAME
// environment variable.
var table = process.env.TABLE_NAME;

// If we provide a GSIK value smaller than 2, then only 1 GSIK partition will
// be created. Since this value is important, it is asked explicitly for it.
var Book = Model({ type: 'Book', documentClient, maxGSIK: 0 });
var Author = Model({ type: 'Author', documentClient, maxGSIK: 0 });

Promise.all([
  Book.create({
    data: 'Elantris',
    properties: [
      {
        Type: 'Published',
        Data: '21/04/2005'
      },
      {
        Type: 'PublishedBy',
        Data: 'Tor Books'
      }
    ]
  }),
  Author.create({
    data: 'Brandon Sanderson',
    properties: [
      {
        Type: 'Gender',
        Data: 'Male'
      },
      {
        Type: 'Born',
        Data: '19/12/1975'
      }
    ]
  })
])
  .then(([book, author]) => {
    return book.connect({ type: 'Author', target: author });
  })
  .then(book => {
    console.log(book.Edges);
    // [{Node: ..., Data: 'Brandon Sanderson', Target: ..., Type: 'Author'}]
  })
  .catch(error => {
    console.log(error);
  });

// To get a node we use the `get` method, providing the Node.
Book.get('cjbfbo53x0000v3vm5egmtkr7')
  .then(book => {
    console.log(book.type);
    // Book
    console.log(book.data);
    // Mistborn
    console.log(book.properties);
    // [{Type: 'Published', Data: '21/04/2005'}, ...]
    console.log(book.edges);
    // [{Type: 'Author', Data: '21/04/2005', Target: 'cjbfbo53x00v3vm5egmtkr7']
  })
  .catch(error => {
    console.log(error);
  });

// To get a list of models we use the `collection` method.
Book.collection()
  .then(books => {
    books.forEach(book => {
      console.log(book.data);
    });
    // Elantris
    // Mistborn
  })
  .catch(error => {
    console.log(error);
  });
```

All the functions return a promise, with a new model in the result, or a list
of models. I was thinking if it would be useful to mutate the initial model, but
ended up opting not to. Might change in the future, or I'll might add that
feature under a new flag.

## Documentation

**TODO**

I tried to include information on each function as a JSDoc comment. I plan in
the future to transform it into a proper documentation page. I wish there was
something like `Sphix` for JavaScript.

## Playground

To test the model in action, I set up a simple playground. On the `scripts`
folder you'll find some scripts to easily set everything up. I might also add
a docker version in the future.

As test data, I am using this [Simpsons Kaggle data](https://www.kaggle.com/wcukierski/the-simpsons-by-the-data). You should
downloaded from the link, and added into the database. It should be as easy as
copy the dump on the `scripts` folder and then run the necessary scripts.

It is composed of four files:

* `simpsons_characters.csv`: List of all the characters with lines on the
  simpsons.
* `simpsons_episodes.csv`: List of all "The Simpsons" episodes.
* `simpsons_loactions.csv`: List of all the locations of the series.
* `simpsons_script_lines.csv`: List of all the episodes lines.

They are structured in a very relational way. We have to store this information
following our graph-like model. So, the first things we need to ask ourselves
is: what queries do I want to run against this data?

In my case I decided to do the following:

* Episodes stream url?
* Episodes per season?
* Episodes with more than X imbd_rating?
* Episodes with more than X votes?
* Episodes released on year?
* Episodes with more than X viewers?

The `locations` and `characters` tables can be easily map to a GraphModel:

```javascript
var Character = GraphModel({
  type: 'character',
  key: 'name',
  properties: ['gender']
});

var Location = GraphModel({
  type: 'location',
  key: 'name'
});
```

On the other hand, the `episodes` table is a little bit more tricky. We could
just store each row as a node property, but that would make it a little bit hard
to query. Instead we will create some other node models, and then set
connections between them.

```javascript
var Season = GraphModel({
  type: 'season',
  key: 'number',
  nodeGenerator: ({ number }) => `season#${number}`
});

var Rating = GraphModel({
  type: 'rating',
  key: 'value',
  nodeGenerator: ({ number }) => `rating#${number}`
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
```

## Queries

```javascript
function log(v) {
  return console.log.bind(console)(JSON.stringify(v, null, 2));
}

function destroy() {
  return dynamo
    .deleteTable({
      TableName: 'GraphTable'
    })
    .promise()
    .then(log)
    .catch(log);
}

function scan() {
  return db
    .scan({
      TableName: 'GraphTable',
      Limit: 100
    })
    .promise()
    .then(log)
    .catch(log);
}

function query(options) {
  var { exp, value, index, gsi = 1 } = options;
  var expression = '#GSIK = :GSIK';
  if (exp) expression += ` AND ${exp}`;
  var params = {
    TableName: 'GraphTable',
    IndexName: `By${index}`,
    KeyConditionExpression: expression,
    ExpressionAttributeNames: Object.assign(
      { '#GSIK': `GSIK` },
      exp ? { '#Sort': index } : {}
    ),
    ExpressionAttributeValues: Object.assign(
      { ':GSIK': `simpsons#${gsi}` },
      value ? { ':Value': value } : {}
    ),
    ReturnConsumedCapacity: 'INDEXES'
  };
  //console.log(JSON.stringify(params, null, 2));
  return db
    .query(params)
    .promise()
    .then(log)
    .catch(log);
}

function get(node, type) {
  return db.get({
    TableName: 'GraphTable',
    Key: {
      Node: node,
      Type: type
    }
  });
}
```

## Test

I am using `jest` to test the library. So, just clone the repo, install the
dependencies, and run `yarn test` or `npm run test` to run them.

```
git clone git@github.com:guzmonne/dynamodb-graph.git
yarn install
yarn test
```

## Licence

MIT
