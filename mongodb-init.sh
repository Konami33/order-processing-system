#!/bin/bash

# Start MongoDB in the background
mongod --replSet rs0 --bind_ip_all &

# Wait for MongoDB to start
until mongosh --eval "db.adminCommand('ping')"; do
    echo "Waiting for MongoDB to start..."
    sleep 1
done

# Initialize the replica set
mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongodb:27017' }] })"

# Keep the container running
wait