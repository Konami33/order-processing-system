const mongoose = require('mongoose');
const amqp = require('amqplib');
const logger = require('./logger');
const Order = require('./models/Order');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/orders_db';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'order_queue';

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    logger.info('Connected to RabbitMQ');

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        try {
          const { orderId } = JSON.parse(msg.content.toString());
          logger.info(`Processing order ${orderId}`);

          // Simulate processing (e.g., inventory check, payment)
          const order = await Order.findById(orderId);
          if (!order) {
            logger.error(`Order ${orderId} not found`);
            channel.nack(msg, false, false);
            return;
          }

          if (order.status !== 'CREATED') {
            logger.warn(`Order ${orderId} already processed, status: ${order.status}`);
            channel.ack(msg);
            return;
          }

          // Simulate business logic (e.g., payment processing)
          order.status = 'PROCESSING';
          order.processedAt = new Date();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
          order.status = Math.random() > 0.1 ? 'SHIPPED' : 'CANCELLED'; // 90% success
          order.paymentStatus = order.status === 'SHIPPED' ? 'PAID' : 'FAILED';
          order.trackingNumber = order.status === 'SHIPPED' ? `TRK${orderId}` : null;
          await order.save();

          logger.info(`Order ${orderId} processed, status: ${order.status}`);
          channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing order: ${error.message}`);
          channel.nack(msg, false, true); // Requeue on failure
        }
      }
    }, { noAck: false });
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    process.exit(1);
  }
}

async function connectMongoDB() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function start() {
  await connectMongoDB();
  await connectRabbitMQ();
  logger.info('Order Processor Service started');
}

start();