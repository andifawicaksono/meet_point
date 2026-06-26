require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/config/socket');
const { connectDB } = require('./src/config/db');
const { client: redisClient } = require('./src/config/redis');

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  // Connect to PostgreSQL (exits on failure)
  await connectDB();

  // Connect to Redis (non-fatal — app degrades gracefully if Redis is down)
  await redisClient.connect().catch((err) =>
    console.warn('[Redis] Startup connect failed (non-fatal):', err.message),
  );

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  return server;
}

const serverPromise = bootstrap();

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  const server = await serverPromise;
  server.close(async () => {
    console.log('[Server] HTTP server closed');
    await redisClient.quit().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
