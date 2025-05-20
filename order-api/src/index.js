const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const logger = require('./logger');
const Order = require('./models/Order');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/orders_db';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'order_queue';

let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    logger.info('Connected to RabbitMQ');
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

// POST /orders
app.post('/orders', async (req, res) => {
  try {
    const { customerId, customerEmail, items, shippingAddress } = req.body;

    // Basic validation
    if (!customerId || !customerEmail || !items || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const order = new Order({
      customerId,
      customerEmail,
      items,
      shippingAddress,
      status: 'CREATED',
      paymentStatus: 'PENDING'
    });

    await order.save();
    logger.info(`Order created: ${order._id}`);

    // Publish to RabbitMQ
    const message = JSON.stringify({ orderId: order._id });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
    logger.info(`Published order ${order._id} to RabbitMQ`);

    res.status(201).json({ orderId: order._id, status: order.status });
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:id
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await connectMongoDB();
  await connectRabbitMQ();
  logger.info(`Order API Service running on port ${PORT}`);
});