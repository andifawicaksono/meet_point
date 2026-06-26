const { sequelize } = require('../models');

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('[DB] PostgreSQL connection established');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[DB] Schema synchronised (alter: true)');
    }
  } catch (err) {
    console.error('[DB] Unable to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
