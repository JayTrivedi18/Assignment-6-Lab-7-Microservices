'use strict';

/**
 * Configuration-Based Service Registry
 * ─────────────────────────────────────
 * Service URLs are read from environment variables at gateway startup.
 *
 * To change a service location, update the environment variable and
 * restart the gateway — NO changes to server.js routing code are required.
 *
 * Local Docker defaults use Docker Compose service DNS names so the gateway
 * can resolve them over the shared campus-network bridge.
 *
 * Cloud/Atlas defaults can be supplied via the same variable names through
 * platform-level environment configuration (e.g. Render, Railway, Fly.io).
 */

const services = {
  user:    process.env.USER_SERVICE_URL    || 'http://user-service:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
  order:   process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'
};

// Log the resolved service registry at startup so it is visible in docker logs
console.log('[API Gateway] Configuration-based Service Registry:');
console.log(`  user-service    -> ${services.user}`);
console.log(`  product-service -> ${services.product}`);
console.log(`  order-service   -> ${services.order}`);

module.exports = services;
