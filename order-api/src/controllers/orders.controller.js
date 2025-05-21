const Order = require('../models/order.model');
const { publishMessage } = require('../services/rabbitmq.service');
const logger = require('../utils/logger');
const { trace, SpanStatusCode } = require('@opentelemetry/api');

async function createOrder(req, res, next) {
  const tracer = trace.getTracer('order-api');
  return tracer.startActiveSpan('create-order', async (span) => {
    try {
      const { customerId, customerEmail, items, shippingAddress } = req.body;

      span.addEvent('Validating order input');
      if (!customerId || !customerEmail || !items || !shippingAddress) {
        const error = new Error('Missing required fields');
        error.status = 400;
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      }

      span.addEvent('Calculating total amount');
      const totalAmount = items.reduce((total, item) => {
        if (!item.price || !item.quantity) {
          const error = new Error('Item price or quantity missing');
          error.status = 400;
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        }
        return total + (item.price * item.quantity);
      }, 0);

      span.addEvent('Creating order document');
      const order = new Order({
        customerId,
        customerEmail,
        items,
        shippingAddress,
        totalAmount,
        status: 'CREATED',
        paymentStatus: 'PENDING',
      });

      span.addEvent('Saving order to MongoDB');
      await order.save();
      logger.info(`Order created: ${order._id}`, {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        traceFlags: span.spanContext().traceFlags.toString(16),
      });
      span.setAttribute('order.id', order._id.toString());

      span.addEvent('Publishing message to RabbitMQ');
      await publishMessage({ orderId: order._id.toString() });

      span.setStatus({ code: SpanStatusCode.OK });
      res.status(201).json({ orderId: order._id.toString(), status: order.status });
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      next(error);
    } finally {
      span.end();
    }
  });
}

async function getOrder(req, res, next) {
  const tracer = trace.getTracer('order-api');
  return tracer.startActiveSpan('get-order', async (span) => {
    try {
      span.addEvent('Fetching order from MongoDB');
      const order = await Order.findById(req.params.id);
      if (!order) {
        const error = new Error('Order not found');
        error.status = 404;
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      }
      span.setAttribute('order.id', order._id.toString());
      span.setStatus({ code: SpanStatusCode.OK });
      res.json(order);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      next(error);
    } finally {
      span.end();
    }
  });
}

module.exports = { createOrder, getOrder };