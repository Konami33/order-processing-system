const config = {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/orders_db?replicaSet=rs0',
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queueName: 'order_queue',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
  
  module.exports = config;