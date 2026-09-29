# CampusConnect Microservices — Lab 7
## API Gateway, Service Discovery & Cloud Deployment
**Web Services & Service-Oriented Architecture**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Lab 6 Baseline](#2-lab-6-baseline)
3. [Lab 7 Objectives](#3-lab-7-objectives)
4. [Final Architecture](#4-final-architecture)
5. [API Gateway](#5-api-gateway)
6. [Gateway Routing Table](#6-gateway-routing-table)
7. [Gateway Health Check](#7-gateway-health-check)
8. [Request Logging](#8-request-logging)
9. [Error Handling](#9-error-handling)
10. [Configuration-Based Service Discovery](#10-configuration-based-service-discovery)
11. [Static vs Dynamic Service Discovery](#11-static-vs-dynamic-service-discovery)
12. [Docker Network](#12-docker-network)
13. [Environment Variables](#13-environment-variables)
14. [Local Docker Deployment](#14-local-docker-deployment)
15. [Local Postman Testing](#15-local-postman-testing)
16. [Configuration Change Demonstration](#16-configuration-change-demonstration)
17. [Cloud Deployment](#17-cloud-deployment)
18. [Public Gateway URL](#18-public-gateway-url)
19. [Cloud Postman Testing](#19-cloud-postman-testing)
20. [Troubleshooting](#20-troubleshooting)
21. [Screenshots / Evidence](#21-screenshots--evidence)
22. [Reflection](#22-reflection)

---

## 1. Project Overview

**CampusConnect** is a university microservices platform built across two labs:

- **Lab 6** — Three independent microservices (User, Product, Order) with isolated MongoDB databases and inter-service REST communication.
- **Lab 7** — Adds an **API Gateway** as the single external entry point, **configuration-based service discovery**, and **cloud deployment** readiness.

### Project Structure

```
Assignment_6_202512123/          ← Lab 7 lives here (co-located with Lab 6)
│
├── api-gateway/                 ← NEW in Lab 7
│   ├── server.js                  Gateway server (routing, logging, error handling)
│   ├── config/
│   │   └── services.js            Configuration-based service registry
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── user-service/                ← Unchanged from Lab 6
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── product-service/             ← Unchanged from Lab 6
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── order-service/               ← Unchanged from Lab 6
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── architecture/
│   └── lab7-architecture.svg    Architecture diagram
│
├── screenshots/
│   └── evidence-checklist.md    Manual screenshot guide
│
├── compose.yaml                 Lab 7 Compose (gateway + services, no host ports on services)
├── compose.lab6.yaml            Lab 6 Compose preserved for reference
├── .env.example                 Environment variable template
├── .gitignore
├── README.md                    This file
└── Microservices - Lab 7.postman_collection.json
```

---

## 2. Lab 6 Baseline

Lab 6 established:

| Service | Internal Port | Database |
|---------|--------------|----------|
| User Service | 3001 | `campusconnect_users` |
| Product Service | 3002 | `campusconnect_products` |
| Order Service | 3003 | `campusconnect_orders` |

**Inter-service communication:** Order Service calls User Service and Product Service via REST (axios) to validate referenced users and products before creating an order.

**Lab 6 architecture:**
```
Client/Postman
    ├── localhost:3001  (User Service)
    ├── localhost:3002  (Product Service)
    └── localhost:3003  (Order Service)
                ├── http://user-service:3001
                └── http://product-service:3002
```

> **Lab 7 preserves all Lab 6 resource designs, endpoints, request/response structures, and status codes.**

---

## 3. Lab 7 Objectives

1. ✅ Add a real **API Gateway** (Node.js + Express + http-proxy-middleware)
2. ✅ Implement **configuration-based service discovery** via environment variables
3. ✅ Ensure **only the gateway** is externally exposed
4. ✅ Prepare for **cloud deployment** with MongoDB Atlas
5. ✅ Create updated **Postman collection** using gateway as the single entry point
6. ✅ Document architecture and provide evidence checklist

---

## 4. Final Architecture

```
Internet / Postman
        │
        │  HTTP  http://localhost:4000  (local)
        │         https://<cloud-url>  (cloud)
        ▼
┌──────────────────────────────────┐
│          API Gateway             │
│          Port 4000               │  ← ONLY externally exposed port
│                                  │
│  /health        (local handler)  │
│  /users/*    → user-service      │
│  /products/* → product-service   │
│  /orders/*   → order-service     │
└───────────────┬──────────────────┘
                │
    ┌───────────┼────────────┐
    │           │            │
    ▼           ▼            ▼
User Svc    Product Svc   Order Svc
:3001        :3002          :3003
(internal)  (internal)    (internal)
    │           │            │  ↕ inter-service
    │           │            │  REST calls
    ▼           ▼            ▼
User DB     Product DB   Order DB
(MongoDB)   (MongoDB)    (MongoDB)
     ↕            ↕           ↕
  [Local Docker MongoDB] or [MongoDB Atlas (cloud)]
```

**Key Lab 7 requirement:** User, Product, and Order services have **no host port mapping** in `compose.yaml`. External traffic must enter through the gateway.

---

## 5. API Gateway

**Technology:** Node.js + Express + [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)

**Why API Gateway?**

An API Gateway provides a **single entry point** for all client requests. Without it, clients must know the addresses of every microservice — a tight coupling that breaks as the system evolves.

Benefits implemented in this lab:

| Benefit | Implementation |
|---------|---------------|
| Single entry point | All traffic enters via port 4000 |
| Hides internal structure | Client never sees :3001/:3002/:3003 |
| Centralised logging | Every proxied request is logged with method, path, target, status |
| Centralised error handling | Unreachable upstreams return 502 JSON (not raw connection errors) |
| Configuration-based routing | Service URLs come from env vars, not hard-coded in route handlers |
| Easier client integration | Client only needs one base URL |

**Gateway does NOT contain business logic.** It routes, logs, and handles errors only.

---

## 6. Gateway Routing Table

All routes use `{{gatewayBaseUrl}}` = `http://localhost:4000` (local) or the public cloud URL.

| Method | Gateway Path | Proxied To | Description |
|--------|-------------|------------|-------------|
| `GET` | `/health` | *(local — not proxied)* | Gateway health check |
| `GET` | `/users` | `user-service:3001/users` | List all users |
| `GET` | `/users/:id` | `user-service:3001/users/:id` | Get user by ID |
| `POST` | `/users` | `user-service:3001/users` | Create user |
| `PUT` | `/users/:id` | `user-service:3001/users/:id` | Update user |
| `DELETE` | `/users/:id` | `user-service:3001/users/:id` | Delete user |
| `GET` | `/products` | `product-service:3002/products` | List all products |
| `GET` | `/products/:id` | `product-service:3002/products/:id` | Get product by ID |
| `POST` | `/products` | `product-service:3002/products` | Create product |
| `PUT` | `/products/:id` | `product-service:3002/products/:id` | Update product |
| `DELETE` | `/products/:id` | `product-service:3002/products/:id` | Delete product |
| `GET` | `/orders` | `order-service:3003/orders` | List all orders |
| `GET` | `/orders/:id` | `order-service:3003/orders/:id` | Get order by ID |
| `POST` | `/orders` | `order-service:3003/orders` | Create order |

**Proxy behaviour:** Original HTTP method, path, request body, query parameters, and relevant headers are preserved.

---

## 7. Gateway Health Check

```
GET /health
```

Handled **locally by the gateway** — not proxied to any upstream service.

**Response (200):**
```json
{
  "status": "UP",
  "service": "api-gateway",
  "port": 4000,
  "upstreamServices": {
    "user-service":    "http://user-service:3001",
    "product-service": "http://product-service:3002",
    "order-service":   "http://order-service:3003"
  }
}
```

The `upstreamServices` field shows the currently configured service registry — useful for verifying configuration changes.

---

## 8. Request Logging

Every proxied request produces a log line:

```
[API Gateway] METHOD /path -> service-name
[API Gateway] METHOD /path -> service-name -> STATUS_CODE
```

**Examples:**

```
[API Gateway] GET /users -> user-service
[API Gateway] GET /users -> user-service -> 200

[API Gateway] POST /orders -> order-service
[API Gateway] POST /orders -> order-service -> 201

[API Gateway] GET /users -> user-service -> UNREACHABLE (connect ECONNREFUSED ...)
```

To view logs: `docker compose logs api-gateway -f`

> Sensitive secrets are never logged. Only method, path, service name, and status code appear.

---

## 9. Error Handling

### Upstream service unreachable

If a proxied service is down or unreachable, the gateway returns **502 Bad Gateway**:

```json
{
  "error": "Service unavailable",
  "service": "user-service",
  "message": "The upstream service could not be reached. Please try again later."
}
```

**Chosen status code: 502 Bad Gateway** — the gateway received an invalid response from (or could not reach) the upstream server. This is semantically correct.

> The original Lab 6 service status codes (404, 409, 503 from order-service when its upstream is down) are **unchanged**. The gateway's 502 only applies when the gateway itself cannot reach an upstream.

### Unknown gateway routes

```json
{
  "error": "Not found",
  "message": "The gateway has no route for GET /unknown",
  "availableRoutes": ["/health", "/users/*", "/products/*", "/orders/*"]
}
```

### No HTML error pages

The gateway never leaks raw Node.js stack traces or Docker connection errors to the client. All errors return clean JSON.

---

## 10. Configuration-Based Service Discovery

### How it works

Service URLs are stored in `api-gateway/config/services.js`:

```js
// GOOD: references env vars — never hard-coded
const services = {
  user:    process.env.USER_SERVICE_URL    || 'http://user-service:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
  order:   process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'
};
```

Route handlers reference the registry:

```js
// GOOD: uses serviceRegistry.user, NOT a hard-coded URL
app.use('/users',    makeProxy('user-service',    serviceRegistry.user));
app.use('/products', makeProxy('product-service', serviceRegistry.product));
app.use('/orders',   makeProxy('order-service',   serviceRegistry.order));
```

### At startup

The gateway prints its resolved service registry:

```
[API Gateway] Configuration-based Service Registry:
  user-service    -> http://user-service:3001
  product-service -> http://product-service:3002
  order-service   -> http://order-service:3003
```

This is visible in `docker compose logs api-gateway`.

---

## 11. Static vs Dynamic Service Discovery

### What this lab implements: Static/Configuration-based Discovery

| Property | This Lab |
|----------|---------|
| How | Environment variables (`USER_SERVICE_URL`, etc.) |
| When resolved | At gateway startup |
| Change mechanism | Update env var → restart gateway |
| Complexity | Low |
| Suited for | Fixed, small-scale deployments |

**This is static discovery** — the locations are configuration values, not discovered dynamically.

### Dynamic Discovery (NOT implemented — for comparison)

| Tool | Mechanism |
|------|-----------|
| Consul | Services register themselves; gateway queries Consul's HTTP API to find instances |
| Eureka (Spring Cloud) | Java-centric service registry with heartbeats |
| Kubernetes DNS | Services register automatically as DNS names within the cluster |
| AWS Cloud Map | Managed service registry for AWS |

Dynamic discovery is better suited for:
- Environments where service IP/port changes frequently
- Horizontally scaled services (multiple instances)
- Auto-scaling environments

For this lab's scale, environment variable–based discovery is **appropriate, correct, and sufficient**.

---

## 12. Docker Network

**Network name:** `campus-network`  
**Driver:** `bridge`

All services (gateway, user-service, product-service, order-service, and all MongoDB containers) share `campus-network`.

Docker's built-in DNS resolves service names:
- `user-service` → container IP of user-service
- `product-service` → container IP of product-service
- `order-service` → container IP of order-service

**Critical Lab 7 requirement:**

```yaml
# CORRECT — only gateway has a host port
api-gateway:
  ports:
    - "4000:4000"     ← accessible from host

user-service:
  # NO ports: section — internal only
  
product-service:
  # NO ports: section — internal only

order-service:
  # NO ports: section — internal only
```

Verify with: `docker compose ps` — only `api-gateway` should show `0.0.0.0:4000->4000/tcp`.

---

## 13. Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `GATEWAY_PORT` | api-gateway | `4000` | Port the gateway listens on |
| `USER_SERVICE_URL` | api-gateway | `http://user-service:3001` | User service location (service discovery) |
| `PRODUCT_SERVICE_URL` | api-gateway | `http://product-service:3002` | Product service location |
| `ORDER_SERVICE_URL` | api-gateway | `http://order-service:3003` | Order service location |
| `PORT` | user-service | `3001` | User service listen port |
| `MONGODB_URI` | user-service | `mongodb://user-mongodb:27017/campusconnect_users` | User MongoDB connection |
| `PORT` | product-service | `3002` | Product service listen port |
| `MONGODB_URI` | product-service | `mongodb://product-mongodb:27017/campusconnect_products` | Product MongoDB connection |
| `PORT` | order-service | `3003` | Order service listen port |
| `MONGODB_URI` | order-service | `mongodb://order-mongodb:27017/campusconnect_orders` | Order MongoDB connection |
| `USER_SERVICE_URL` | order-service | `http://user-service:3001` | For Lab 6 inter-service calls |
| `PRODUCT_SERVICE_URL` | order-service | `http://product-service:3002` | For Lab 6 inter-service calls |

Copy `.env.example` to `.env` and fill in real values for cloud deployment.

---

## 14. Local Docker Deployment

### Prerequisites

- Docker Desktop (with Docker Compose v2)
- Git (optional)

### Steps

```bash
# 1. Navigate to the project
cd "D:\Web Services & SOA\Assignment_6_202512123"

# 2. Build all images
docker compose build

# 3. Start all services in the background
docker compose up -d

# 4. Verify all 7 containers are running
docker compose ps

# 5. View gateway startup logs (service registry should be printed)
docker compose logs api-gateway

# 6. Test gateway health
curl http://localhost:4000/health
```

### Expected `docker compose ps` output

```
NAME              IMAGE                     COMMAND                  STATUS         PORTS
api-gateway       assignment_6...-api-gateway   "node server.js"     Up             0.0.0.0:4000->4000/tcp
user-service      assignment_6...-user-service  "node server.js"     Up
user-mongodb      mongo                         "docker-entrypoint…" Up (healthy)
product-service   assignment_6...-product-service "node server.js"   Up
product-mongodb   mongo                         "docker-entrypoint…" Up (healthy)
order-service     assignment_6...-order-service "node server.js"     Up
order-mongodb     mongo                         "docker-entrypoint…" Up (healthy)
```

> `user-service`, `product-service`, and `order-service` will show **no PORTS column entry** — they are internal only.

---

## 15. Local Postman Testing

Import `Microservices - Lab 7.postman_collection.json` into Postman.

Set the collection variable:

| Variable | Local Value |
|----------|------------|
| `gatewayBaseUrl` | `http://localhost:4000` |

### Test execution order

1. **Gateway Health** — verify `GET /health` → 200
2. **Gateway → User** — `POST /users` to create user id=1, then `GET /users`, `GET /users/1`
3. **Gateway → Product** — `POST /products` to create product id=101, then `GET /products`, `GET /products/101`
4. **Gateway → Order** — `POST /orders` with userId=1, productId=101 → 201; then `GET /orders`
5. **Error Handling** — invalid userId → 404; stop user-service → 502; restart → 200 recovery
6. **Service Discovery** — `GET /health` to see `upstreamServices` registry

---

## 16. Configuration Change Demonstration

This demonstrates that service location is controlled by configuration, not code.

### Steps to demonstrate

```bash
# 1. Start the stack normally
docker compose up -d

# 2. Verify baseline — GET /health shows:
#    "user-service": "http://user-service:3001"

# 3. Edit compose.yaml — change USER_SERVICE_URL for api-gateway to a test value:
#    USER_SERVICE_URL: http://user-service:3001  ← change this to a different host

# 4. Restart only the gateway (no code changes)
docker compose up -d api-gateway

# 5. GET /health again — upstreamServices.user-service shows the NEW URL
#    This proves the gateway reads location from config, not from server.js
```

**Key point:** `api-gateway/server.js` is NOT modified. Only the environment variable changes. This is configuration-based service discovery in action.

> **Evidence required:** Screenshot of `GET /health` before and after the env var change. See `screenshots/evidence-checklist.md` items 13a and 13b.

---

## 17. Cloud Deployment (Render + MongoDB Atlas — Plan B)

### Deployment Strategy

All four services are deployed as **Render Web Services** (free tier).

On Render's free tier, every Web Service receives a public HTTPS URL (`https://<name>.onrender.com`). There is **no network-level isolation** between services at this tier.

| Aspect | Detail |
|---|---|
| Platform | [Render](https://render.com) |
| Service type | Web Service (Docker), all four services |
| Database | MongoDB Atlas (M0 Free cluster) |
| Region | Oregon (US West) — all four services must match |
| Intended entry point | API Gateway URL only |

> **Free-tier trade-off:** Because Render Web Services always have public URLs, the three microservice URLs (`user-service`, `product-service`, `order-service`) are technically publicly addressable on the Internet. This is a known limitation of the free tier.
>
> **The API Gateway remains the correct and intended external entry point for this application.** All Postman testing and client requests should use only the gateway URL. Direct microservice URLs exist but are not the intended interface.
>
> If stricter network isolation were required, the three microservices could be redeployed as **Render Private Services** (`type: pserv`) on a paid plan, making them unreachable from the public Internet and accessible only to services within the same Render account.

---

### Cloud Topology (Plan B)

```
        Postman / Client
               |
               v  HTTPS
  ┌────────────────────────────┐
  │  PUBLIC — Intended Entry   │
  │  campusconnect-api-gateway │
  │  https://<gw>.onrender.com │
  └──────────┬─────────────────┘
             │  HTTPS (env-var-configured URLs)
   ┌──────────┼──────────┐
   v          v          v
┌────────┐ ┌────────┐ ┌────────┐
│ user-  │ │product-│ │ order- │
│service │ │service │ │service │
│(web)   │ │(web)   │ │(web)   │
│public* │ │public* │ │public* │
└───┬────┘ └───┬────┘ └───┬────┘
    │           │     ┌────┘
    │           │     │  HTTPS (inter-service calls)
    │           │  ┌──┴──────────────┐
    │           │  │ order-service   │
    │           │  │ also calls:     │
    │           └──→ user-service    │
    └──────────────→ product-service │
                   └─────────────────┘
    │           │          │
    v           v          v
┌──────────────────────────────────┐
│          MongoDB Atlas           │
│  campusconnect_users             │
│  campusconnect_products          │
│  campusconnect_orders            │
└──────────────────────────────────┘

* public = has a Render URL but should not be used directly by clients
```

---

### Render Services Overview

| Render Service Name | Type | Free-Tier URL | Role |
|---|---|---|---|
| `campusconnect-user-service` | Web Service | `https://campusconnect-user-service.onrender.com` *(example)* | User CRUD + Atlas |
| `campusconnect-product-service` | Web Service | `https://campusconnect-product-service.onrender.com` *(example)* | Product CRUD + Atlas |
| `campusconnect-order-service` | Web Service | `https://campusconnect-order-service.onrender.com` *(example)* | Order CRUD + Atlas + inter-service calls |
| `campusconnect-api-gateway` | Web Service | `https://campusconnect-api-gateway.onrender.com` *(example)* | **Public entry point — use this URL** |

> ⚠️ The URLs in the table above are **illustrative format examples only**. Real Render URLs are assigned by Render when each service is created and must be obtained from the Render dashboard. Do not use example URLs as real values.

---

### Render Blueprint

A [`render.yaml`](./render.yaml) Blueprint is included in the repository root. It defines all four services and can be used to auto-scaffold them via the Render Blueprint feature.

- All four services are `type: web`
- All secrets (`MONGODB_URI`) and service URLs use `sync: false` — they are **never stored in this file**
- Real values must be entered manually in the Render dashboard after each service is created

---

### Step-by-Step Deployment

#### Prerequisites

- GitHub repository with this code pushed (including `render.yaml`)
- MongoDB Atlas account — free M0 cluster is sufficient
- Render account — free tier

---

#### Step 1 — MongoDB Atlas Setup

Create **one Atlas cluster** (or three separate clusters) and prepare **three connection strings** — one per database.

For each database:

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create a free **M0 cluster**
2. **Database Access** → Add a database user (username + strong password)
3. **Network Access** → Add IP Address → `0.0.0.0/0` *(allow connections from anywhere — required for Render)*
4. **Connect → Drivers** → Copy the connection string

Connection string format:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
```

Required database names:

| Service | Database name in URI |
|---|---|
| user-service | `campusconnect_users` |
| product-service | `campusconnect_products` |
| order-service | `campusconnect_orders` |

> **Password tip:** URL-encode any special characters in the Atlas password before pasting into the URI (e.g. `@` → `%40`, `#` → `%23`, `!` → `%21`).

---

#### Step 2 — Deploy `campusconnect-user-service` (deploy first)

1. Render Dashboard → **New → Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `campusconnect-user-service`
   - **Runtime:** Docker
   - **Dockerfile path:** `./user-service/Dockerfile`
   - **Docker build context:** `./user-service`
   - **Region:** Oregon (US West)
   - **Instance type:** Free
4. Set environment variables:

   | Variable | Value |
   |---|---|
   | `PORT` | `10000` |
   | `MONGODB_URI` | *(paste your Atlas URI for campusconnect_users — mark as Secret)* |

5. Click **Create Web Service** → wait until status is **Live**
6. **Copy the assigned service URL** from the Render dashboard
   - Format: `https://campusconnect-user-service.onrender.com`
   - You will need this URL for step 4 (order-service) and step 5 (api-gateway)

---

#### Step 3 — Deploy `campusconnect-product-service` (deploy second)

Same procedure as Step 2:

| Variable | Value |
|---|---|
| `PORT` | `10000` |
| `MONGODB_URI` | *(paste your Atlas URI for campusconnect_products — mark as Secret)* |

After **Live**: copy the assigned service URL — needed for step 4 and step 5.

---

#### Step 4 — Deploy `campusconnect-order-service` (deploy third)

The order-service calls user-service and product-service to validate users and products when creating orders. Their actual Render URLs must be set as environment variables.

| Variable | Value |
|---|---|
| `PORT` | `10000` |
| `MONGODB_URI` | *(paste your Atlas URI for campusconnect_orders — mark as Secret)* |
| `USER_SERVICE_URL` | *(paste the actual Live URL of campusconnect-user-service from Step 2)* |
| `PRODUCT_SERVICE_URL` | *(paste the actual Live URL of campusconnect-product-service from Step 3)* |

After **Live**: copy the assigned service URL — needed for step 5.

> **Configuration-based service discovery in action:** The order-service reads `USER_SERVICE_URL` and `PRODUCT_SERVICE_URL` from its environment at startup. No application code changes are needed — only environment variable values.

---

#### Step 5 — Deploy `campusconnect-api-gateway` (deploy last)

The API Gateway is the intended public entry point. It routes all client traffic to the appropriate microservice using the URLs configured in its environment.

| Variable | Value |
|---|---|
| `PORT` | `10000` |
| `USER_SERVICE_URL` | *(paste the actual Live URL of campusconnect-user-service from Step 2)* |
| `PRODUCT_SERVICE_URL` | *(paste the actual Live URL of campusconnect-product-service from Step 3)* |
| `ORDER_SERVICE_URL` | *(paste the actual Live URL of campusconnect-order-service from Step 4)* |

After **Live**: copy the **gateway URL** — this is the URL to use in Postman.

> **How configuration-based service discovery works on Render:**
> `api-gateway/config/services.js` reads `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, and `ORDER_SERVICE_URL` from the process environment at startup. Setting these in the Render dashboard is the only step needed to point the gateway at the deployed services — no `server.js` edits, no code changes, no redeployment of application logic.

---

### Environment Variables Reference

#### `campusconnect-user-service`

| Variable | Secret? | Value |
|---|---|---|
| `PORT` | No | `10000` |
| `MONGODB_URI` | **Yes** | `mongodb+srv://...campusconnect_users...` |

#### `campusconnect-product-service`

| Variable | Secret? | Value |
|---|---|---|
| `PORT` | No | `10000` |
| `MONGODB_URI` | **Yes** | `mongodb+srv://...campusconnect_products...` |

#### `campusconnect-order-service`

| Variable | Secret? | Value |
|---|---|---|
| `PORT` | No | `10000` |
| `MONGODB_URI` | **Yes** | `mongodb+srv://...campusconnect_orders...` |
| `USER_SERVICE_URL` | No | Actual Render URL of user-service (from dashboard) |
| `PRODUCT_SERVICE_URL` | No | Actual Render URL of product-service (from dashboard) |

#### `campusconnect-api-gateway`

| Variable | Secret? | Value |
|---|---|---|
| `PORT` | No | `10000` |
| `USER_SERVICE_URL` | No | Actual Render URL of user-service (from dashboard) |
| `PRODUCT_SERVICE_URL` | No | Actual Render URL of product-service (from dashboard) |
| `ORDER_SERVICE_URL` | No | Actual Render URL of order-service (from dashboard) |

> `GATEWAY_PORT` is **not** set on Render. The gateway's port resolution chain is `GATEWAY_PORT || PORT || 4000` — it will pick up Render's injected `PORT=10000` automatically.

---

### MongoDB Atlas Requirements

| Requirement | Detail |
|---|---|
| Cluster tier | M0 Free |
| Databases required | 3 (`campusconnect_users`, `campusconnect_products`, `campusconnect_orders`) |
| Auth | Username + URL-encoded password |
| Network access | `0.0.0.0/0` (required — Render egress IPs are not fixed on free tier) |
| URI format | `mongodb+srv://` (Atlas SRV — do **not** use `mongodb://`) |

---

### Security

- **Never** commit real Atlas connection strings to the repository
- All Atlas URIs must be set in the Render dashboard and marked as **Secret**
- `render.yaml` uses `sync: false` for all secrets — they are not stored in this file
- `.env` is excluded by `.gitignore`
- `.env.example` contains only format placeholders — safe to commit

---

## 18. Public Gateway URL

> **NOT YET DEPLOYED — MANUAL STEP REQUIRED**
>
> After completing the Render deployment steps above, record the gateway URL here:
>
> `PUBLIC_GATEWAY_URL = NOT_YET_DEPLOYED`
>
> Obtain the real URL from the Render dashboard after `campusconnect-api-gateway` reaches **Live** status. Update this value before Postman cloud testing.

---

## 19. Cloud Postman Testing

After all four services are Live on Render:

1. In the Postman collection, update the `gatewayBaseUrl` collection variable:
   ```
   gatewayBaseUrl = https://<your-actual-gateway-name>.onrender.com
   ```
   Replace `http://localhost:4000` with the real gateway URL from the Render dashboard.

2. Re-run all requests — all routes, all CRUD operations, all status codes

3. Capture screenshots for evidence (see `screenshots/evidence-checklist.md` items 15–19)

Expected request flow:
```
Postman
  → https://<gateway>.onrender.com          (API Gateway)
    → https://<user-service>.onrender.com   (User Service → Atlas)
    → https://<product-service>.onrender.com (Product Service → Atlas)
    → https://<order-service>.onrender.com  (Order Service → Atlas)
```

> **Cloud testing status: NOT VERIFIED — deployment not yet performed**



---

## 20. Troubleshooting

### Gateway returns 502

```
GET http://localhost:4000/users → 502
```

**Cause:** `user-service` container is not running or not yet healthy.

```bash
docker compose ps          # check user-service status
docker compose logs user-service  # check for errors
docker compose restart user-service
```

### MongoDB healthcheck failing

```bash
docker compose logs user-mongodb
```

The healthcheck uses `mongosh` (newer) with `mongo` as a fallback. If neither is available, the container image may be too old — use `image: mongo:7` explicitly.

### Port 4000 already in use

```bash
netstat -ano | findstr :4000
# Kill the process using that port, then:
docker compose up -d
```

### Gateway logs not showing

```bash
docker compose logs api-gateway --tail=50 -f
```

### Services start out of order

`depends_on` in compose.yaml ensures order. If an issue persists:

```bash
docker compose down && docker compose up -d
```

---

## 21. Screenshots / Evidence

See [`screenshots/evidence-checklist.md`](./screenshots/evidence-checklist.md) for the complete list of required screenshots.

All screenshots are **manual captures** — none are pre-generated.

---

## 22. Reflection

### What Lab 7 adds over Lab 6

| Aspect | Lab 6 | Lab 7 |
|--------|-------|-------|
| Client entry points | 3 (one per service) | 1 (gateway) |
| External ports | 3001, 3002, 3003 | 4000 only |
| Service discovery | Hard-coded in Order Service | Env vars in gateway |
| Request logging | Per-service | Centralised at gateway |
| Error handling | Per-service | Centralised + per-service |
| Cloud readiness | Local MongoDB | MongoDB Atlas |

### Why API Gateway?

The API Gateway pattern solves the **fan-out problem**: when a system has many microservices, clients should not need to discover and call each one individually. Instead, a single gateway acts as the façade:

- Clients know one address
- Services can move or scale without breaking clients
- Cross-cutting concerns (logging, auth, rate-limiting) can be added once

### Configuration-based vs Dynamic Discovery

This lab uses **static configuration** — service URLs are environment variables. This is simple, transparent, and appropriate for a fixed small-scale deployment.

**Dynamic discovery** (Consul, Kubernetes DNS, Eureka) becomes necessary when:
- Services spin up/down dynamically (auto-scaling)
- Multiple instances of a service exist and need load balancing
- Service IPs change frequently

Understanding both approaches is fundamental to designing scalable service-oriented systems.

---

*CampusConnect — Web Services & SOA, Lab 7*  
*Node.js · Express · http-proxy-middleware · Docker · MongoDB Atlas*
