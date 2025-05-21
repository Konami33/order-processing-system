const amqp = require('amqplib');
const logger = require('../utils/logger');
const config = require('../config');
const { context, propagation } = require('@opentelemetry/api');

let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(config.rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(config.queueName, { durable: true });
    logger.info('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

async function publishMessage(message) {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  const headers = {};
  propagation.inject(context.active(), headers);
  channel.sendToQueue(config.queueName, Buffer.from(JSON.stringify(message)), {
    persistent: true,
    headers,
  });
  logger.info(`Published message to ${config.queueName}: ${JSON.stringify(message)}`);
}

module.exports = { connectRabbitMQ, publishMessage };