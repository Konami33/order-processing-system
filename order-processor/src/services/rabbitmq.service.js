const amqp = require('amqplib');
const logger = require('../utils/logger');
const config = require('../config');

async function connectRabbitMQ(consumerCallback) {
  try {
    const connection = await amqp.connect(config.rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue(config.queueName, { durable: true });
    logger.info('Connected to RabbitMQ');

    channel.consume(config.queueName, consumerCallback, { noAck: false });
    return channel;
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

module.exports = { connectRabbitMQ };