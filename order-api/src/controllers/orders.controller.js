const Order = require('../models/order.model');
const { publishMessage } = require('../services/rabbitmq.service');
const logger = require('../utils/logger');

async function createOrder(req, res, next) {
  try {
    const { customerId, customerEmail, items, shippingAddress } = req.body;

    // Basic validation
    if (!customerId || !customerEmail || !items || !shippingAddress) {
      const error = new Error('Missing required fields');
      error.status = 400;
      throw error;
    }

    // Calculate totalAmount
    const totalAmount = items.reduce((total, item) => {
      if (!item.price || !item.quantity) {
        const error = new Error('Item price or quantity missing');
        error.status = 400;
        throw error;
      }
      return total + (item.price * item.quantity);
    }, 0);

    const order = new Order({
      customerId,
      customerEmail,
      items,
      shippingAddress,
      totalAmount,
      status: 'CREATED',
      paymentStatus: 'PENDING',
    });

    await order.save(); // Save the order to the database
    logger.info(`Order created: ${order._id}`);

    await publishMessage({ orderId: order._id }); // Publish the order to RabbitMQ
    res.status(201).json({ orderId: order._id, status: order.status });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id); // Find the order by ID
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    res.json(order); // Send the order as a JSON response
  } catch (error) {
    next(error);
  }
}

module.exports = { createOrder, getOrder };