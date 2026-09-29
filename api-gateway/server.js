'use strict';

/**
 * API Gateway — Lab 7
 * ════════════════════════════════════════════════════════════════════
 * Single externally-exposed entry point for the CampusConnect
 * microservices platform.
 *
 * Responsibilities:
 *   • Route /users/*    → User Service
 *   • Route /products/* → Product Service
 *   • Route /orders/*   → Order Service
 *   • GET /health       (handled locally — not proxied)
 *   • Request logging   (method, path, target service, response status)
 *   • Centralised error handling (502 on unreachable upstream)
 *
 * What this gateway does NOT do:
 *   • No business logic
 *   • No hard-coded service URLs inside route handlers
 *   • No duplication of User/Product/Order domain logic
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ─── Configuration-based service registry ────────────────────────────────────
// Service URLs come from environment variables. Change an env var and restart
// the gateway to point at a different service location — no code edits needed.
const serviceRegistry = require('./config/services');

const app  = express();
const PORT = process.env.GATEWAY_PORT || process.env.PORT || 4000;


// ─── Proxy factory ───────────────────────────────────────────────────────────
/**
 * Creates a proxy middleware for a named upstream service.
 *
 * @param {string} serviceName  human-readable name used in log lines
 * @param {string} targetUrl    resolved from serviceRegistry — never hard-coded
 */
function makeProxy(serviceName, targetUrl, pathPrefix) {
  return createProxyMiddleware({
    // pathFilter ensures only matching paths are proxied; the full original
    // path (including the prefix) is forwarded unchanged to the upstream.
    // This avoids the path-stripping bug that occurs when using
    // app.use('/prefix', proxy) with http-proxy-middleware v3.
    pathFilter: pathPrefix,
    target: targetUrl,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        // Log the outgoing request
        console.log(`[API Gateway] ${req.method} ${req.originalUrl} -> ${serviceName}`);
      },
      proxyRes: (proxyRes, req) => {
        // Log the response status code
        console.log(`[API Gateway] ${req.method} ${req.originalUrl} -> ${serviceName} -> ${proxyRes.statusCode}`);
      },
      error: (err, req, res) => {
        // Upstream unreachable — return a clean 502 JSON response
        console.error(`[API Gateway] ${req.method} ${req.originalUrl} -> ${serviceName} -> UNREACHABLE (${err.message})`);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Service unavailable',
            service: serviceName,
            message: 'The upstream service could not be reached. Please try again later.'
          });
        }
      }
    }
  });
}

// ─── Gateway health check (handled locally) ──────────────────────────────────
app.get('/health', (req, res) => {
  console.log('[API Gateway] GET /health -> gateway (local) -> 200');
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    port: PORT,
    upstreamServices: {
      'user-service':    serviceRegistry.user,
      'product-service': serviceRegistry.product,
      'order-service':   serviceRegistry.order
    }
  });
});

// ─── Proxy routes ─────────────────────────────────────────────────────────────
// Mounted at root (app.use) with pathFilter so Express does NOT strip the
// /users, /products, /orders prefix before the proxy sees the request.
// This is the correct pattern for http-proxy-middleware v3:
//   app.use('/prefix', proxy)  ← WRONG: Express strips /prefix → upstream gets /
//   app.use(proxy w/ pathFilter) ← CORRECT: full path forwarded unchanged
//
// Route handlers reference the service registry, NOT hard-coded URLs.
// Changing USER_SERVICE_URL env var reroutes the gateway without code edits.

app.use(makeProxy('user-service',    serviceRegistry.user,    '/users'));
app.use(makeProxy('product-service', serviceRegistry.product, '/products'));
app.use(makeProxy('order-service',   serviceRegistry.order,   '/orders'));

// ─── 404 catch-all for unknown gateway routes ────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `The gateway has no route for ${req.method} ${req.originalUrl}`,
    availableRoutes: ['/health', '/users/*', '/products/*', '/orders/*']
  });
});

// ─── Global error handler ────────────────────────────────────────────────────
// Catches any synchronous errors not already handled by the proxy error hook.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[API Gateway] Unhandled error for ${req.method} ${req.originalUrl}:`, err.message);
  if (!res.headersSent) {
    res.status(502).json({
      error: 'Gateway error',
      message: err.message
    });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
  console.log(`[API Gateway] Routes: /health (local), /users/* /products/* /orders/* (proxied)`);
});
