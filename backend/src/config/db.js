const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
    } catch (err) {
      console.warn(`Could not connect to external MongoDB at ${uri}. Starting embedded in-memory MongoDB...`);
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      uri = mongodInstance.getUri();
      await mongoose.connect(uri);
      console.log(`Embedded MongoDB connected at: ${uri}`);
    }

    // Sync indexes with the current schema on startup. autoIndex only
    // creates missing indexes on a fresh DB - it won't alter an existing
    // index in place. User.email moved from a non-sparse to a sparse
    // unique index (so multiple wallet-only users with no email don't
    // collide); on a pre-existing DB still carrying the old non-sparse
    // email_1 index, a second email-less user would hit an E11000
    // duplicate-key error without this.
    const User = require('../models/User');
    await User.syncIndexes();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
