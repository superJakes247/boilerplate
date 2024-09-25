/* eslint-disable no-promise-executor-return */
const amqp = require('amqplib');
const promiseWhile = require('promise-while-loop');
const { merge } = require('lodash');
const _ = require('lodash');
const fs = require('fs-extra');
const { format, subMilliseconds } = require('date-fns');
const request = require('./request');
const {
  apiName, chalk, debugLogger,
} = require('./_common');

const rabbitmqUri = process.env.RABBITMQ_PLATFORM_URI || process.env.AG_RETAIL_RABBITMQ_URL || 'amqp://deploy_user:guest@app-rabbitmq-server-platform/retail%2Fplatform';
const rabbitmqBaseUrl = process.env.RABBITMQ_BASE_URL || 'http://app-rabbitmq-server-platform:15672';

class RabbitMQ {
  async init() {
    debugLogger(chalk.blackBright.bold('Test:'), chalk.blackBright(expect.getState().currentTestName));
    this.rabbitLog = [];
    this.connection = await amqp.connect(rabbitmqUri);
    this.channel = await this.connection.createChannel();
    await this.channel.ackAll();
    debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue(`Connected to ${chalk.blueBright(rabbitmqUri)}:`), chalk.green('\u2713'));

    const rabbitQueues = await request({
      baseURL: rabbitmqBaseUrl, url: '/api/queues/retail%2Fplatform', auth: { username: 'deploy_user', password: 'guest' },
    });
    await Promise.all(rabbitQueues.data.map(async (queue) => {
      await this.channel.purgeQueue(queue.name);
    }));
    await Promise.all(rabbitQueues.data.map(async (queue) => {
      let pollingOneMessage = true;
      await promiseWhile(
        () => pollingOneMessage,
        async () => {
          const { messageCount } = await this.channel.checkQueue(queue.name);
          pollingOneMessage = !(messageCount === 0);
          await new Promise((timer) => setTimeout(timer, 25));
        },
      );
    }));

    debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue('Purged all queues:'), chalk.green('\u2713'));
    process.env.DRAW_SEQ_DIAGRAM = false;
    return this;
  }

  async publish({
    routingKey, payload, exchange = 'publish', options = {},
  }) {
    const messageOptions = {
      headers: {
        CorrelationId: Date.now().toString(36) + Math.random().toString(36).substring(2),
        Source: 'source system',
        MessageBodyType: '',
        MessageBodyMode: '',
      },
      contentType: 'application/octet-stream',
      internal: true,
    };
    await this.channel.checkExchange(exchange);
    const isPublished = await this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), merge(messageOptions, options));
    if (!isPublished) {
      throw new Error(chalk.red(`${chalk.redBright('RabbitMQ:')} Error occured while attempting to submit payload on 'publish' exchange`));
    } else {
      debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue(`Published successfully to ${chalk.blueBright(routingKey)}:`), chalk.green('\u2713'));
      if (!fs.existsSync(`./generated/${apiName}/request.log.json`)) {
        fs.outputFileSync(`./generated/${apiName}/request.log.json`, '');
      }
      fs.appendFileSync(
        `./generated/${apiName}/request.log.json`,
        `${JSON.stringify({ url: routingKey, method: 'PUBLISH', timestamp: new Date().toISOString() }, null, 2)}|`,
        { mode: 0o777 },
      );
      this.rabbitLog.push({
        from: 'rabbit',
        to: apiName,
        path: routingKey.replace('#', ''),
        method: 'PUBLISH',
        timestamp: format(subMilliseconds(new Date(), 100), 'yyyy-mm-dd HH:mm:ss.SSS'),
      });
      this.routingKey = routingKey;
    }
    return this;
  }

  async messagesFromQueue(queue, options = {}) {
    const {
      expectedMessageCount, timeoutSec, toApi, fileName, deliveryTags,
    } = options;
    let pollingOneMessage = true;
    let polling = true;
    let errors;
    const messagesOfInterest = [];
    const messagesOfInterestMeta = [];

    await this.channel.checkQueue(queue);

    let previousMessageCount = -1;
    let currentMessageCount = 0;
    let messageCountDifference = -1;
    let confirmNoMoreMessages = 1;
    let messageCheckLimit = 200;

    const start = new Date();
    // waiting for atleast 1 message in the queue
    await promiseWhile(
      () => pollingOneMessage,
      async () => {
        const { messageCount } = await this.channel.checkQueue(queue);
        pollingOneMessage = !(messageCount >= 1) && !(messageCheckLimit < 0);
        await new Promise((timer) => setTimeout(timer, 25));
        const end = new Date() - start;
        debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue(`...Waiting for messages on ${chalk.blueBright(queue)}: Received:`), chalk.blackBright(messageCount), `in ${end}ms`);
        messageCheckLimit -= 1;
      },
    );

    // waiting for all other messages
    messageCheckLimit = (timeoutSec * 100) || 100;
    await promiseWhile(
      () => polling,
      async () => {
        const { messageCount } = await this.channel.checkQueue(queue);
        currentMessageCount = messageCount;

        if (expectedMessageCount) {
          confirmNoMoreMessages = (currentMessageCount === expectedMessageCount) ? confirmNoMoreMessages + 1 : 1;
          polling = !((currentMessageCount === expectedMessageCount) && (confirmNoMoreMessages >= 10)) && !(messageCheckLimit < 0);
          await new Promise((timer) => setTimeout(timer, 25));
          messageCheckLimit -= 1;
          errors = (messageCheckLimit < 0) ? `${chalk.redBright('RabbitMQ: ')} ${chalk.red(`current message count != expected message count: ${currentMessageCount} != ${expectedMessageCount}`)}` : undefined;
        } else {
          messageCountDifference = previousMessageCount - currentMessageCount;
          previousMessageCount = currentMessageCount;

          confirmNoMoreMessages = (messageCountDifference === 0) ? confirmNoMoreMessages + 1 : 1;
          // confirm there are no more messages coming in. 30 times.
          polling = !((messageCountDifference === 0) && (confirmNoMoreMessages >= 100) && (messageCheckLimit < 0));
          await new Promise((timer) => setTimeout(timer, 1000 / (confirmNoMoreMessages * 2)));
          messageCheckLimit -= 1;
        }

        const end = new Date() - start;
        debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue(`...Waiting for messages on ${chalk.blueBright(queue)}: Received:`), chalk.blackBright(currentMessageCount), `in ${end}ms`);
      },
    );

    const consumer = await this.channel.consume(
      queue,
      (message) => {
        const messageContent = (typeof JSON.parse(message.content).default === 'undefined') ? JSON.parse(message.content) : JSON.parse(message.content).default;
        try {
          messagesOfInterest.push({ routingKey: message.fields.routingKey, message: messageContent });
          messagesOfInterestMeta.push({
            routingKey: message.fields.routingKey, message: messageContent, deliveryTag: message.fields.deliveryTag, timestamp: message.properties.headers.Timestamp,
          });
        } catch (e) {
          if (e instanceof SyntaxError) {
            messagesOfInterest.push({ routingKey: message.fields.routingKey, message: messageContent });
            messagesOfInterestMeta.push({
              routingKey: message.fields.routingKey, message: messageContent, deliveryTag: message.fields.deliveryTag, timestamp: message.properties.headers.Timestamp,
            });
          }
        }
      },
      { noAck: true, exclusive: true },
    );

    await this.channel.cancel(consumer.consumerTag);

    // when no delivery tag specified use all
    const allDeliveryTags = Array.from(Array(messagesOfInterestMeta.length).keys()).map((a) => a + 1);
    const deliveryTag = deliveryTags || allDeliveryTags;

    debugLogger(chalk.magenta(`RabbitMQ: message from ${queue} : `), chalk.grey(JSON.stringify(messagesOfInterestMeta, null, 2)));

    if (errors) {
      throw new Error(`${errors} ${chalk.grey(JSON.stringify(messagesOfInterestMeta, null, 2))}`);
    }

    if (!fs.existsSync(`./generated/${apiName}/request.log.json`)) {
      fs.outputFileSync(`./generated/${apiName}/request.log.json`, '');
    }

    messagesOfInterestMeta.filter((f) => f.timestamp).map((m) => {
      fs.appendFileSync(
        `./generated/${apiName}/request.log.json`,
        `${JSON.stringify({ url: m.routingKey, method: 'PUBLISH', timestamp: new Date().toISOString() }, null, 2)}|`,
        { mode: 0o777 },
      );

      return this.rabbitLog.push({
        from: (m.routingKey === this.routingKey) ? 'rabbit' : apiName,
        to: (m.routingKey === this.routingKey) ? apiName : 'rabbit',
        apiName,
        path: m.routingKey.replace('#', ''),
        method: 'PUBLISH',
        timestamp: format(new Date(m.timestamp), 'yyyy-mm-dd HH:mm:ss.SSS'),
      });
    });

    if (toApi) {
      messagesOfInterestMeta.forEach((m) => {
        if (deliveryTag.includes(m.deliveryTag)) {
          const to = `${toApi}/rabbitmq`;
          const apiUnderTest = process.env.TEST_ENV_URL.replace('http://', '').replace(':3000', '');
          const toRoute = _.kebabCase(m.routingKey);

          const storeagePath = './generated/outgoing-requests/';
          const testName = _.kebabCase(fileName) || _.kebabCase(expect.getState().currentTestName);

          const jsonPath = `${storeagePath}${to}/${toRoute}/from-${apiUnderTest}/${testName}.json`;

          debugLogger(chalk.magenta('RabbitMQ:'), chalk.green('Saved'), chalk.yellow('outgoing request payload:'), chalk.blackBright(jsonPath));
          fs.outputFileSync(jsonPath, JSON.stringify(m.message, null, 2));
        }
      });
    }

    return messagesOfInterest;
  }

  async tearDown() {
    await this.channel.ackAll();
    await this.channel.close();
    await this.connection.close();
    debugLogger(chalk.magenta('RabbitMQ: '), chalk.blue(`Closing connection to ${chalk.blueBright(rabbitmqUri)}:`), chalk.green('\u2713'));

    if (process.env.DRAW_SEQ_DIAGRAM !== 'false') {
      fs.outputFileSync(
        `./generated/${apiName}/sequence/${process.env.DRAW_SEQ_DIAGRAM}/rabbit.log.json`,
        JSON.stringify(this.rabbitLog, null, 2),
      );
    }

    return this;
  }
}

module.exports = RabbitMQ;
