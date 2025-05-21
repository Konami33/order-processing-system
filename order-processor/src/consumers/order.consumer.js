const Order = require('../models/order.model');
const logger = require('../utils/logger');

async function processOrderMessage(msg, channel) {
  if (msg === null) return;

  try {
    const { orderId } = JSON.parse(msg.content.toString());
    logger.info(`Processing order ${orderId}`);

    const order = await Order.findById(orderId); // Find the order by ID
    if (!order) {
      logger.error(`Order ${orderId} not found`);
      channel.nack(msg, false, false); // Reject the message
      return;
    }

    if (order.status !== 'CREATED') {
      logger.warn(`Order ${orderId} already processed, status: ${order.status}`);
      channel.ack(msg); // Acknowledge the message
      return;
    }

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

module.exports = { processOrderMessage };