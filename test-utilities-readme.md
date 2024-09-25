# lib-test-utilities
> This test utility contains api test helpers

## Create tests folder
`./tests`

## docker-compose.yml service
```
  testtools:
    image: 860638170744.dkr.ecr.af-south-1.amazonaws.com/common/node-testtools:16
    user: node
    volumes:
      - ./:/api
    working_dir: /api/tests

```

##  Install utility
```shell
docker-compose run --rm testtools npm install @agct/test-utilities --save-dev  
```
---
---
## Whats in the box

### [Request helper](./documentation/REQUEST.md)

> Small helper to centralize the request library used for testing APIs

### Usage
Set environment variable to the Base Url being tested
```shell
TEST_ENV_URL=http://api-name:3000 
```
---
**request(options)** Makes a request
- `options :` \<Object\> [Request options](./documentation/REQUEST.md#-Request-options)
- `returns :` \<Promise\> \<Object\> [Response](./documentation/REQUEST.md#-Response)
---
---
### [Command line interface(CLI)](./documentation/CLI.md)
> Set of CLI commands to help initial setup of test structure

### Usage

```shell
docker-compose run <service> npx agct-test-utils <command>
```

```shell
Options:
  -h, --help               display help for command

Commands:
  init [options] [path]    copy all the jest and js config needed to run the tests
  pull-swagger-file <url>  download swagger file from url, url is the path to swagger.json/swagger.yml
  schemas [path]           generate/update schemas from swagger file
  urls [path]              generate/update url definitions from swagger file
  tests [options] [path]   generate/update tests from swagger file
  auto-index <path>        automatically create index files for nested json files
  create-sql-mock <path>   convert sql table data into an mocked proc, view or seed script
  help [command]           display help for command
```

---
---
### [API-MOCK-SERVER helper](./documentation/API-MOCK-SERVER.md)
> Mock server helpers to load fixtures and validate mocked requests

### Usage
---
**new MockServer([apis])** Create a mock server instance
- `apis :` \<Array\> List of APIs to be mocked eg. ['api-1', 'api-2']

**mockServer.init()** Sets up the api-mock-server
- `returns` \<Promise\>
---
**mockServer.loadFixtures([fixtures], options)** Loads fixture data
- `fixtures :` \<Array\> of [JSON fixture files](./documentation/FIXTURE-FILES.md)
- `options :` \<Object\> 
  - `matchType :` \<String\> request body matching "STRICT" or "ONLY_MATCHING_FIELDS"
  - `contentType :` \<String\> response content type eg 'text\html'
- `returns :` \<Promise\> 
---
**mockServer.outgoingRequests(fixtureFile, options)** Collects all outgoing request made by the API
- `fixtureFile :` \<Object\> Optional file by [JSON fixture file](./documentation/FIXTURE-FILES.md)
- `options :` \<Object\> 
  - `fileName :` \<String\> file name of the payloads being saved  
- `returns :` \<Promise\> \<Array\> list of outgoing Requests
---
**mockServer.tearDown()** Validates mocked requests and cleans up
- `returns :` \<Promise\>
---
---
### [RABBITMQ helper](./documentation/RABBITMQ.md)
> Rabbitmq helper to connect to the rabbit server and allow for interactions
### Usage
---
**rabbitmq.init()** Sets up connection to the rabbit server and cleans all queues
- `returns` \<Promise\>
---
**rabbitmq.publish({ routingKey, payload, exchange, options })** Publish a message on the "PUBLISH EXCHANGE"
- `routingKey :` \<String\> the routingKey { routingKey: 'My routing key' }
- `payload :` \<Object\> Payload message to be sent { payload: { My payload }}
- `exchange :` \<String\> exchange name, default=publish
- `options :`  \<Object\> optional param if supplied input object will override the default.  
- `returns :` \<Promise\>
---
**rabbitmq.messagesFromQueue(queue,options)** Waits for all the messages on a queue and consumes them
- `queue :` \<String\> The queue name
- `options :` \<Object\> { expectedMessageCount } optional check on the number of messages in queue _( RECOMMENDED for faster tests )_
  - `expectedMessageCount :` \<Number\> eg. 3
  - `timeoutSec :` \<Number\> polling timeout override in seconds eg. 3
  - `toApi :` \<Number\> api that will be consuming this message
  - `fileName :` \<Number\> filename of the message payload
  - `deliveryTags :` \<Array\> save particular outgoing command eg. [1,3] will save the 1st and 3rd outgoing commands
- `returns :` \<Promise\> \<Array\> A list of messages from that queue
---
**rabbitmq.tearDown()** Closes the connection to the rabbit server
- `returns` \<Promise\>

---
---
### [JWT(json web token) helper](./documentation/JWT-CREATE.md)
> JWT helper to create a signed token 
### Usage
---
**jwtHeaders.create(partyId, tokenPreset)** creates a JWT token for a given partyId
- `partyId: ` \<String\> siebel partyId of the user accessing the data, usually online user.
- `tokenPreset` \<Function\> One of a list of predefined functions 
    - [ isValid, isExpired, hasNoUniqueName, hasNoPartyId, hasAdviserRoleContext, isIssuedAfterExpiry, hasUmbrellaAccessAllanGrayAdmin,isNotValidUntilFuture ]
- `returns :` \<Object\> { Authorization: Bearer xxxxxxxxxxxx }
---
---
### [JEST helper](./documentation/JEST.md)

> Jest helper for common jest setup
- Defaults
  - `Timeout :` 30sec
  - `Retries :` Once
---
---
### Additional Expects
**toHaveValidSchema(responseBody, schema, log)** Validates response against swagger schema
- `responseBody :` \<Object\> APIs response body
- `schema :` \<Object\> swagger schema for an endpoint
- `log :` \<Array\> anything to log on a failure

---
**toBe(received, expected, log)** Match a to b with logging
- `received :` \<Any\> a
- `expected :` \<Any\> b
- `log :` \<Array\> anything to log on a failure

---
**toMatchArraySnapshot(arrayList)** Creates a snapshot for a list of items
- `arrayList :` \<Array\> List of items to snapshot
