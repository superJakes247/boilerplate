# Testing APIs

# Existing tests
## Install node packages
```shell
docker-compose run --rm testtools npm ci
```
---
---
## Execute the tests
### Pre [verification tests](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/VERIFICATION-TESTS.md) ( _runs in ci_ )
```shell
docker-compose run --rm verification npm run test:ci
```
### Post [verification tests](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/VERIFICATION-TESTS.md) ( _runs in env = DEV | INT | UAT_ )
```shell
docker-compose run --rm verification npm run test:<env>
```
### [Acceptance tests](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/ACCEPTANCE-TESTS.md) ( _mocked tests_ )
```shell
docker-compose run --rm acceptance npm run test:acceptance
```
## Updating snapshots
Pass in the `-u` jest command
```shell
docker-compose run --rm acceptance npm run test:acceptance -- -u
```
---
---
## Execute specific tests
Can pass in cli options from jest] (https://jestjs.io/docs/en/cli.html#--testnamepatternregex) prefix with ` -- `

Run tests by name:
```shell
docker-compose run --rm verification npm run test:ci -- -t <test name/description>
docker-compose run --rm verification npm run test:<env> -- -t <test name/description>
docker-compose run --rm acceptance npm run test:acceptance -- -t <test name/description>

    e.g. docker-compose run --rm acceptance npm run test:acceptance -- -t 'can GET on path /people/search'
```
Run tests by a specific path:
```
docker-compose run --rm verification npm run test:ci -- --runTestsByPath <full test file path>
docker-compose run --rm acceptance npm run test:acceptance -- --runTestsByPath <full test file path>

    e.g. docker-compose run --rm acceptance npm run test:acceptance -- --runTestsByPath __acceptance__/GET-organisations.test.js
```
Run a specific test file ('groups' config required)
```
docker-compose run --rm verification npm run test:ci <test file name>
docker-compose run --rm acceptance npm run test:acceptance <test file name>

    e.g. docker-compose run --rm verification npm run test:ci GET-people-person-id.test
```
**More detailed documentation on executing specific tests can be found here: **
### [RUN-SPECIFIC-TESTS](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/RUN-SPECIFIC-TESTS.md)

## Debugging ( _shows extra debug information_ )
### [Verification tests](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/VERIFICATION-TESTS.md)
```shell
docker-compose run --rm verification npm run test:ci:debug -- -t <test name/description>
```
### [Acceptance tests](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/ACCEPTANCE-TESTS.md)
```shell
docker-compose run --rm acceptance npm run test:acceptance:debug -- -t <test name/description>
```
> Generate fixtures
```shell
docker-compose run --rm acceptance npm run test:acceptance:generate -- -t <test name/description>
```
> Update fixtures
```shell
docker-compose run --rm acceptance npm run test:acceptance:generate -- -t <test name/description> -u
```
---
---
## Troubleshooting

- Running against old code
    - Make sure you force rebuild the api image everytime the api code is changed
    - [GO API](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/API-LOCAL-SETUP-GO.md)
        ```shell
        docker-compose down && docker-compose run go-build && docker-compose build --no-cache --pull --force-rm
        ```
    - [SCALA API](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/API-LOCAL-SETUP-SCALA.md)
        ```shell
        docker-compose down && docker-compose run scala-build && docker-compose build --no-cache --pull --force-rm
        ```
- Issues starting your tests ?
    - Delete all running docker containers
        ```shell
        docker rm -f `docker ps -qa`
        ``` 
- API under test doesnt start up ?
    - [API Local setup](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/DOCKER-COMPOSE.md)

# No tests in this repo
### Setup your local environment --> [docker-compose](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/DOCKER-COMPOSE.md)
---
### First time creating tests --> [JS Tests setup](https://gitlab.gray.net/retail-testing/lib-test-utilities/-/blob/master/documentation/JS-TESTS-SETUP.md)
---
---