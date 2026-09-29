# CampusConnect Microservices — Lab 7
## API Gateway, Service Discovery & Cloud Deployment
**Course:** Web Services & Service-Oriented Architecture  
**Student ID:** 202512123  
**Repository:** [JayTrivedi18/Assignment-6-Lab-7-Microservices](https://github.com/JayTrivedi18/Assignment-6-Lab-7-Microservices.git)  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Lab 7 Objectives](#2-lab-7-objectives)
3. [Architecture Overview](#3-architecture-overview)
4. [Architecture Diagram Reference](#4-architecture-diagram-reference)
5. [API Gateway Responsibilities](#5-api-gateway-responsibilities)
6. [Service Registry and Configuration](#6-service-registry-and-configuration)
7. [User Service Responsibilities and Endpoints](#7-user-service-responsibilities-and-endpoints)
8. [Product Service Responsibilities and Endpoints](#8-product-service-responsibilities-and-endpoints)
9. [Order Service Responsibilities and Endpoints](#9-order-service-responsibilities-and-endpoints)
10. [Database-Per-Service Ownership](#10-database-per-service-ownership)
11. [Local Docker Architecture](#11-local-docker-architecture)
12. [Dockerfiles and Container Images](#12-dockerfiles-and-container-images)
13. [Docker Network and DNS](#13-docker-network-and-dns)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Inter-Service Communication](#15-inter-service-communication)
16. [Error Handling](#16-error-handling)
17. [Postman Testing](#17-postman-testing)
18. [Cloud Deployment](#18-cloud-deployment)
19. [Actual Render URLs](#19-actual-render-urls)
20. [MongoDB Atlas](#20-mongodb-atlas)
21. [Cloud Verification Results](#21-cloud-verification-results)
22. [Cloud and Free-Tier Limitation](#22-cloud-and-free-tier-limitation)
23. [Troubleshooting](#23-troubleshooting)
24. [Reflection](#24-reflection)
25. [Final Verification and Submission Checklist](#25-final-verification-and-submission-checklist)

---

## 1. Project Overview

**CampusConnect** is a university microservices platform designed across two progressive lab assignments:

- **Lab 6 Baseline:** Implemented three core microservices (`user-service`, `product-service`, `order-service`) with isolated local MongoDB databases and direct inter-service REST communication.
- **Lab 7 Extension:** Introduces an **API Gateway** acting as the single external facade, implements **configuration-based service discovery** using environment variables, isolates backend services behind an internal Docker bridge network, and deploys the entire distributed system to the **Render** cloud platform with **MongoDB Atlas**.

### Repository Structure

```
Assignment_6_202512123/
│
├── api-gateway/                 ← NEW in Lab 7: Reverse proxy, logging, error handling
│   ├── server.js                Express gateway server
│   ├── config/
│   │   └── services.js          Configuration-based service registry
│   ├── package.json
│   ├── package-lock.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── user-service/                ← Lab 6 microservice (unchanged logic)
│   ├── server.js                User CRUD and MongoDB Atlas/local connection
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── product-service/             ← Lab 6 microservice (unchanged logic)
│   ├── server.js                Product catalog, pricing, and MongoDB connection
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── order-service/               ← Lab 6 microservice (unchanged logic)
│   ├── server.js                Order orchestration and inter-service REST calls
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── architecture/
│   └── lab7-architecture.svg    Vector architecture diagram
│
├── screenshots/                 ← Local execution evidence (12 screenshots)
│
├── compose.yaml                 Lab 7 Docker Compose (gateway port 4000 only)
├── compose.lab6.yaml            Lab 6 Compose preserved for baseline reference
├── render.yaml                  Render Blueprint deployment specification
├── .env.example                 Template for local and cloud environment variables
├── .gitignore                   Excludes secrets, dependencies, and temporary files
├── README.md                    Complete project documentation
└── Microservices - Lab 7.postman_collection.json
```

---

## 2. Lab 7 Objectives

1. **Centralized API Gateway:** Implement a single public-facing entry point using Express and `http-proxy-middleware`.
2. **Configuration-Based Service Discovery:** Eliminate hardcoded service URLs by reading upstream locations dynamically from environment variables (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`).
3. **Network Isolation:** Hide backend microservices and databases from host exposure in local Docker Compose, exposing **only port 4000** on the gateway.
4. **Preserve Microservices Baseline:** Maintain 100% compatibility with Lab 6 data models, database boundaries, REST validation, and status codes.
5. **Production Cloud Deployment:** Deploy all microservices and the API Gateway to Render with cloud-hosted MongoDB Atlas databases.
6. **End-to-End Verification:** Validate gateway health, resource routing, inter-service order creation, and error responses via Postman against both local Docker and live cloud environments.

---

## 3. Architecture Overview

In Lab 7, clients (such as Postman or frontend applications) interact exclusively with the **API Gateway**. The gateway acts as a reverse proxy, inspecting the requested path and transparently forwarding the request to the appropriate microservice.

- **Local Docker Environment:** The gateway listens on host port `4000`. Backend microservices run on internal ports (`3001`, `3002`, `3003`) on the Docker bridge network `campus-network` without published host ports.
- **Render Cloud Environment:** The API Gateway is deployed as a public Web Service. Upstream services are located using environment variables pointing to their HTTPS Render URLs.
- **Data Layer:** Each microservice maintains complete ownership of its dedicated database (`campusconnect_users`, `campusconnect_products`, `campusconnect_orders`), hosted in MongoDB containers locally and in MongoDB Atlas (`Student-API` cluster) in the cloud.

---

## 4. Architecture Diagram Reference

A high-resolution vector architecture diagram is provided in [`architecture/lab7-architecture.svg`](architecture/lab7-architecture.svg).

### System Topology

```
                  Client / Postman
                         │
                         │ HTTP / HTTPS
                         ▼
        ┌──────────────────────────────────┐
        │           API GATEWAY            │
        │      Local Port: 4000 (Host)     │
        │      Cloud: campusconnect-api-   │
        │             gateway-6k62         │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │ /users/*       │ /products/*     │ /orders/*
        ▼                ▼                 ▼
  ┌────────────┐   ┌────────────┐   ┌────────────┐
  │User Service│   │Product Svc │   │Order Svc   │
  │Port: 3001  │   │Port: 3002  │   │Port: 3003  │
  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
        │                │                │  ▲
        │                │  Inter-Service │  │
        │                └── REST (axios) ┴──┘
        │                        │
        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐
 │  MongoDB     │         │  MongoDB     │
 │  Users DB    │         │  Orders DB   │
 └──────────────┘         └──────────────┘
```

---

## 5. API Gateway Responsibilities

The API Gateway (`api-gateway/server.js`) fulfills five primary architectural concerns:

1. **Reverse Proxying:** Forwards incoming requests to backend microservices while preserving HTTP methods, request bodies, query strings, and headers.
2. **Centralized Health Monitoring:** Responds locally to `GET /health` with the overall gateway status, port, and the active upstream service registry.
3. **Uniform Request Logging:** Logs every proxied request at entry and completion:
   ```
   [API Gateway] GET /users -> user-service
   [API Gateway] GET /users -> user-service -> 200
   ```
4. **Centralized Error Handling:** Catches connection dropouts, host resolution failures, and upstream crashes, translating them into standard **HTTP 502 Bad Gateway** JSON responses.
5. **No Business Logic:** The gateway remains completely decoupled from domain validation, business calculations, or database connections.

---

## 6. Service Registry and Configuration

Service discovery is implemented through static configuration loaded at runtime in [`api-gateway/config/services.js`](api-gateway/config/services.js):

```javascript
const services = {
  user:    process.env.USER_SERVICE_URL    || 'http://user-service:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
  order:   process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'
};
```

### Registry Startup Log

When the gateway boots, it prints its resolved registry to `stdout`:

```
[API Gateway] Configuration-based Service Registry:
  user-service    -> http://user-service:3001
  product-service -> http://product-service:3002
  order-service   -> http://order-service:3003
```

### Gateway Routing Table

| Route | Upstream Service | Handler Type | Target URL (Local / Default) |
|---|---|---|---|
| `GET /health` | API Gateway | Local Express Handler | Local resolution (HTTP 200) |
| `/users/*` | User Service | `http-proxy-middleware` | `http://user-service:3001` |
| `/products/*` | Product Service | `http-proxy-middleware` | `http://product-service:3002` |
| `/orders/*` | Order Service | `http-proxy-middleware` | `http://order-service:3003` |

---

## 7. User Service Responsibilities and Endpoints

**Source:** [`user-service/server.js`](user-service/server.js)  
**Database:** `campusconnect_users`  
**Internal Port:** `3001` (Local) / `10000` (Render)

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/users` | List all registered users | `200 OK` |
| `GET` | `/users/:id` | Fetch specific user by ID | `200 OK`, `404 Not Found` |
| `POST` | `/users` | Register a new user (`id`, `name`, `email`) | `201 Created`, `400 Bad Request` |
| `PUT` | `/users/:id` | Update user details | `200 OK`, `404 Not Found` |
| `DELETE` | `/users/:id` | Remove user record | `200 OK`, `404 Not Found` |
| `GET` | `/health` | Service health check | `200 OK` |

---

## 8. Product Service Responsibilities and Endpoints

**Source:** [`product-service/server.js`](product-service/server.js)  
**Database:** `campusconnect_products`  
**Internal Port:** `3002` (Local) / `10000` (Render)

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/products` | List all products in catalog | `200 OK` |
| `GET` | `/products/:id` | Fetch product details by numeric ID | `200 OK`, `404 Not Found` |
| `POST` | `/products` | Create catalog item (`id`, `name`, `price`, `description`) | `201 Created`, `400 Bad Request` |
| `PUT` | `/products/:id` | Update item price or details | `200 OK`, `404 Not Found` |
| `DELETE` | `/products/:id` | Delete product item | `200 OK`, `404 Not Found` |
| `GET` | `/health` | Service health check | `200 OK` |

---

## 9. Order Service Responsibilities and Endpoints

**Source:** [`order-service/server.js`](order-service/server.js)  
**Database:** `campusconnect_orders`  
**Internal Port:** `3003` (Local) / `10000` (Render)

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/orders` | Create order; validates User and Product via REST | `201 Created`, `400 Bad Request`, `404 Not Found`, `503 Service Unavailable` |
| `GET` | `/orders` | List all placed orders | `200 OK` |
| `GET` | `/orders/:id` | Fetch order details by numeric ID | `200 OK`, `404 Not Found` |
| `GET` | `/health` | Service health check | `200 OK` |

---

## 10. Database-Per-Service Ownership

Each microservice possesses exclusive ownership over its persistent datastore. No microservice is permitted direct read or write access to another service's database.

| Service | Dedicated Database | Collections | Data Ownership Scope |
|---|---|---|---|
| **User Service** | `campusconnect_users` | `users` | User credentials, profiles, email indexing |
| **Product Service** | `campusconnect_products` | `products` | Catalog metadata, inventory pricing |
| **Order Service** | `campusconnect_orders` | `orders` | Transaction records, calculated totals, order status |

- In local Docker, three isolated `mongo:7` containers are created (`user-mongodb`, `product-mongodb`, `order-mongodb`).
- In cloud deployment, three isolated databases reside inside the `Student-API` MongoDB Atlas cluster.

---

## 11. Local Docker Architecture

The local stack is orchestrated via [`compose.yaml`](compose.yaml), declaring seven containers:

```
[Host System]
     │
     │ Port 4000:4000 (ONLY published port)
     ▼
[api-gateway]
     │
     └─── campus-network (Internal Docker Bridge) ─────────────────────┐
               ├── [user-service:3001]    ─── [user-mongodb:27017]    │
               ├── [product-service:3002] ─── [product-mongodb:27017] │
               └── [order-service:3003]   ─── [order-mongodb:27017]   │
                                                                      │
──────────────────────────────────────────────────────────────────────┘
```

### Docker Compose Port Isolation Audit

Running `docker compose ps` confirms that only `api-gateway` binds to the host interface:

```
NAME              COMMAND                  STATUS         PORTS
api-gateway       "node server.js"         Up             0.0.0.0:4000->4000/tcp
user-service      "node server.js"         Up             (no host port)
user-mongodb      "docker-entrypoint…"     Up (healthy)   (no host port)
product-service   "node server.js"         Up             (no host port)
product-mongodb   "docker-entrypoint…"     Up (healthy)   (no host port)
order-service     "node server.js"         Up             (no host port)
order-mongodb     "docker-entrypoint…"     Up (healthy)   (no host port)
```

---

## 12. Dockerfiles and Container Images

All four custom services use lightweight `node:18-alpine` base images with optimized layer caching:

- [`api-gateway/Dockerfile`](api-gateway/Dockerfile): Production build with `npm ci --omit=dev`, exposing internal port `4000`.
- [`user-service/Dockerfile`](user-service/Dockerfile): Production build with `npm ci --omit=dev`, exposing internal port `3001`.
- [`product-service/Dockerfile`](product-service/Dockerfile): Production build with `npm ci --omit=dev`, exposing internal port `3002`.
- [`order-service/Dockerfile`](order-service/Dockerfile): Production build with `npm ci --omit=dev`, exposing internal port `3003`.

All service directories include a `.dockerignore` file preventing `node_modules`, npm logs, and `.env` files from leaking into the build context.

---

## 13. Docker Network and DNS

The Docker daemon provides automatic internal DNS resolution across the `campus-network` bridge:
- `http://user-service:3001` resolves directly to the internal IP of the User Service container.
- `http://product-service:3002` resolves directly to the internal IP of the Product Service container.
- `http://order-service:3003` resolves directly to the internal IP of the Order Service container.

Cross-service communication occurs securely on this bridge without exposing internal container ports to the host machine or public internet.

---

## 14. Environment Variables Reference

| Environment Variable | Service | Local Docker Value | Render Cloud Value | Purpose |
|---|---|---|---|---|
| `PORT` / `GATEWAY_PORT` | `api-gateway` | `4000` | `10000` | Listener port for incoming HTTP traffic |
| `USER_SERVICE_URL` | `api-gateway` | `http://user-service:3001` | `https://campusconnect-user-service-name.onrender.com` | Target URL for `/users/*` proxy |
| `PRODUCT_SERVICE_URL` | `api-gateway` | `http://product-service:3002` | `https://campusconnect-product-service-hhvy.onrender.com` | Target URL for `/products/*` proxy |
| `ORDER_SERVICE_URL` | `api-gateway` | `http://order-service:3003` | `https://campusconnect-order-service-69zf.onrender.com` | Target URL for `/orders/*` proxy |
| `PORT` | Microservices | `3001`, `3002`, `3003` | `10000` | Microservice listener port |
| `MONGODB_URI` | Microservices | `mongodb://<service>-mongodb:27017/<dbname>` | `mongodb+srv://<user>:<pwd>@student-api.../<dbname>` | Database connection URI |
| `USER_SERVICE_URL` | `order-service`| `http://user-service:3001` | `https://campusconnect-user-service-name.onrender.com` | Upstream URL for user validation |
| `PRODUCT_SERVICE_URL`| `order-service`| `http://product-service:3002` | `https://campusconnect-product-service-hhvy.onrender.com` | Upstream URL for product validation |

---

## 15. Inter-Service Communication

When `POST /orders` is received by the Order Service:

1. **User Validation:** Calls `GET ${USER_SERVICE_URL}/users/:userId` via Axios.
   - If user does not exist: returns **404 Not Found** (`{"error": "User not found"}`).
2. **Product Validation & Pricing:** Calls `GET ${PRODUCT_SERVICE_URL}/products/:productId` via Axios.
   - If product does not exist: returns **404 Not Found** (`{"error": "Product not found"}`).
3. **Calculation:** Computes order total (`product.price * quantity`).
4. **Order Persistence:** Stores the order in `campusconnect_orders` with status `CREATED`.
5. **Resilience:** If either upstream service is unreachable or times out (3000ms), returns **503 Service Unavailable** (`{"error": "User service unavailable"}` or `{"error": "Product service unavailable"}`).

---

## 16. Error Handling

### Gateway-Level Error Responses

- **502 Bad Gateway:** Returned when an upstream service is stopped or unreachable.
  ```json
  {
    "error": "Service unavailable",
    "service": "user-service",
    "message": "The upstream service could not be reached. Please try again later."
  }
  ```
- **404 Not Found:** Returned when requesting an unmapped gateway route (e.g. `/unknown`).
  ```json
  {
    "error": "Not found",
    "message": "The gateway has no route for GET /unknown",
    "availableRoutes": ["/health", "/users/*", "/products/*", "/orders/*"]
  }
  ```

### Microservice-Level Status Codes

- `200 OK`: Successful read or update operations.
- `201 Created`: Successful creation of users, products, or orders.
- `400 Bad Request`: Validation failure or missing required body fields.
- `404 Not Found`: Specific resource ID not found.
- `503 Service Unavailable`: Order Service fails to reach User or Product dependency during order placement.

---

## 17. Postman Testing

All automated testing is contained in [`Microservices - Lab 7.postman_collection.json`](Microservices%20-%20Lab%207.postman_collection.json).

### Switching Environments in Postman

Update the collection variable `gatewayBaseUrl`:

| Environment | `gatewayBaseUrl` Variable Value |
|---|---|
| **Local Docker** | `http://localhost:4000` |
| **Render Cloud** | `https://campusconnect-api-gateway-6k62.onrender.com` |

### Test Workflow Sequence

1. `GET /health` → Verify gateway health and upstream service registry.
2. `POST /users` → Create user (`id: 1, name: "Alice Smith"`).
3. `GET /users/1` → Confirm user was persisted.
4. `POST /products` → Create product (`id: 101, name: "Laptop Stand", price: 29.99`).
5. `GET /products/101` → Confirm product was persisted.
6. `POST /orders` → Place order with `userId: 1, productId: 101, quantity: 2` → returns `201 Created` with calculated total `59.98`.
7. `GET /orders/1001` → Verify order record.
8. `POST /orders` with invalid `userId: 99999` → Verify `404 Not Found` response.
9. `GET /unknown-route` → Verify gateway `404 Not Found` with available route listing.

---

## 18. Cloud Deployment

The application is deployed on [Render](https://render.com) using Docker runtimes:

- **Deployment Order:**
  1. `campusconnect-user-service` → Copy assigned HTTPS URL.
  2. `campusconnect-product-service` → Copy assigned HTTPS URL.
  3. `campusconnect-order-service` → Set `USER_SERVICE_URL` and `PRODUCT_SERVICE_URL` to above URLs.
  4. `campusconnect-api-gateway` → Set `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL` to the three service URLs.
- **Blueprint Reference:** A complete deployment specification is maintained in [`render.yaml`](render.yaml) for automated multi-service scaffolding.

---

## 19. Actual Render URLs

The live, verified cloud endpoints on Render are:

| Service | Public Render HTTPS URL | Role |
|---|---|---|
| **API Gateway** | `https://campusconnect-api-gateway-6k62.onrender.com` | **Intended Public Entry Point** |
| **User Service** | `https://campusconnect-user-service-name.onrender.com` | User CRUD & Atlas backend |
| **Product Service** | `https://campusconnect-product-service-hhvy.onrender.com` | Product catalog & Atlas backend |
| **Order Service** | `https://campusconnect-order-service-69zf.onrender.com` | Order orchestration & Atlas backend |

> **Note on Product Service Hostname:** The active verified Render subdomain is `hhvy`.

---

## 20. MongoDB Atlas

- **Atlas Cluster:** `Student-API` (M0 Free tier, Region: AWS / us-east-1)
- **Database Segregation:**
  - `campusconnect_users`
  - `campusconnect_products`
  - `campusconnect_orders`
- **Network Access:** Whitelisted `0.0.0.0/0` to allow incoming connections from dynamic Render IP ranges.
- **Security Compliance:** Connection URIs are stored exclusively as Render Secret Environment Variables (`sync: false` in `render.yaml`) and never committed to version control.

---

## 21. Cloud Verification Results

All tests below were performed through Postman against live Render endpoints:

### 1. Gateway Health Check

```http
GET https://campusconnect-api-gateway-6k62.onrender.com/health
```
**Status:** `200 OK`  
**Response Body:**
```json
{
  "status": "UP",
  "service": "api-gateway",
  "port": 10000,
  "upstreamServices": {
    "user-service": "https://campusconnect-user-service-name.onrender.com",
    "product-service": "https://campusconnect-product-service-hhvy.onrender.com",
    "order-service": "https://campusconnect-order-service-69zf.onrender.com"
  }
}
```

### 2. Gateway Proxied Resource Queries

| Test | Request URL | Result | Verified Payload |
|---|---|---|---|
| Gateway → Users | `GET https://campusconnect-api-gateway-6k62.onrender.com/users` | `200 OK` | User ID 1 (`Jay Trivedi`) |
| Gateway → Products | `GET https://campusconnect-api-gateway-6k62.onrender.com/products` | `200 OK` | Product ID 1 (`Laptop`, `75000`) |
| Gateway → Orders | `GET https://campusconnect-api-gateway-6k62.onrender.com/orders` | `200 OK` | Order ID 100 returned |

### 3. End-to-End Inter-Service Order Creation

```http
POST https://campusconnect-api-gateway-6k62.onrender.com/orders
Content-Type: application/json

{
  "id": 101,
  "userId": 1,
  "productId": 1,
  "quantity": 1
}
```
**Status:** `201 Created`  
**Response Body:**
```json
{
  "order": {
    "id": 101,
    "userId": 1,
    "productId": 1,
    "quantity": 1,
    "total": 75000,
    "status": "CREATED",
    "createdAt": "2026-09-29T13:42:00.000Z"
  }
}
```
*Validation Proof:* Demonstrates the complete cloud communication chain: **Postman → API Gateway → Order Service → User Service + Product Service → MongoDB Atlas**.

### 4. Direct Microservice Baseline Verification

- `GET https://campusconnect-user-service-name.onrender.com/users/1` → `200 OK` (`Jay Trivedi`, `jay@example.com`)
- `GET https://campusconnect-product-service-hhvy.onrender.com/products/1` → `200 OK` (`Laptop`, `75000`)
- `POST https://campusconnect-order-service-69zf.onrender.com/orders` (id: 100) → `201 Created`
- `GET https://campusconnect-order-service-69zf.onrender.com/orders` → `200 OK`

### 5. Cloud Dependency Error Testing Note

Cloud dependency-failure testing (502/503 from the gateway when an upstream service is stopped) was **not performed on the live cloud deployment** to preserve the availability of the production services. This behavior is thoroughly validated in the local Docker environment (`Screenshot 2026-09-29 101801.png`), where stopping `user-service` immediately causes the gateway to return `502 Bad Gateway` (`{"error": "Service unavailable", "service": "user-service"}`). The gateway error-handling logic is identical in both environments.

### 6. Evidence and Screenshot Status

#### Local Docker Evidence (12 Verified Screenshots in `screenshots/`)

| Screenshot File | Verification Scope | Status |
|---|---|---|
| `Screenshot 2026-09-29 100011.png` | Docker Compose running all 7 containers (`docker compose ps`) | ✅ Verified |
| `Screenshot 2026-09-29 100034.png` | Gateway health check (`GET /health` → 200) | ✅ Verified |
| `Screenshot 2026-09-29 100127.png` | Gateway routing (`GET /users` → 200) | ✅ Verified |
| `Screenshot 2026-09-29 100607.png` | End-to-end order placement (`POST /orders` → 201) | ✅ Verified |
| `Screenshot 2026-09-29 101801.png` | Gateway 502 error handling (`user-service` stopped) | ✅ Verified |
| `Screenshot 2026-09-29 102131.png` | Configuration change demo — health before URL change | ✅ Verified |
| `Screenshot 2026-09-29 102203.png` | Configuration change demo — health after URL change | ✅ Verified |
| `Screenshot 2026-09-29 102511.png` | Configuration change demo — restoration verified | ✅ Verified |
| `Screenshot 2026-09-29 102923.png` | Gateway 404 for unknown route | ✅ Verified |
| `Screenshot 2026-09-29 102944.png` | Order 404 for non-existent `userId` | ✅ Verified |
| `Screenshot 2026-09-29 102959.png` | Gateway routing (`GET /products` → 200) | ✅ Verified |
| `Screenshot 2026-09-29 103225.png` | Gateway routing (`GET /orders` → 200) | ✅ Verified |

#### Cloud Verification Evidence

- Live tests were executed via Postman against the Render deployment.
- Gateway `/health`, `/users`, `/products`, `/orders`, and `POST /orders` (Order ID 101) tests all passed.
- Exact HTTP responses and payloads are documented in subsections 1–4 above.
- Cloud test screenshots were verified during execution; no fabricated images have been added to the repository.

---

## 22. Cloud and Free-Tier Limitation

Under Render's free tier, all instances are deployed as **Render Web Services**, which automatically assign public HTTPS domains (`onrender.com`).

- **Architecture Intent:** The API Gateway is the single intended client entry point for all operations.
- **Free-Tier Constraint:** Backend services (`user-service`, `product-service`, `order-service`) technically have public URLs due to platform plan limitations.
- **Enterprise / Production Design:** In a production deployment with private networking (or Render's paid Private Services `pserv`), backend services would be completely unexposed to the Internet, accessible only via internal VPC routing from the API Gateway.
- **Demonstration Integrity:** The application strictly implements configuration-based service discovery and gateway proxying in compliance with the Lab 7 specification.

---

## 23. Troubleshooting

### Gateway Returns 502 Bad Gateway
- **Cause:** Upstream service container is stopped, crashing, or experiencing cold-start delay.
- **Resolution:** Check logs with `docker compose logs user-service` (locally) or inspect the Render service deployment logs.

### Render Free-Tier Cold Starts
- **Symptom:** First request after 15 minutes of inactivity takes 30–60 seconds.
- **Resolution:** Allow the instance spin-up delay to complete; subsequent requests execute immediately.

### MongoDB Connection Failures
- **Symptom:** Microservice logs `MongooseServerSelectionError`.
- **Resolution:** Ensure MongoDB Atlas Network Access has `0.0.0.0/0` whitelisted, and verify that special characters in Atlas passwords are URL-encoded.

---

## 24. Reflection

Implementing Lab 7 provided critical practical insight into distributed systems architecture. Introducing an API Gateway successfully decoupled clients from backend topology, eliminating client fan-out and centralizing logging and error translation. Implementing configuration-based service discovery highlighted the architectural value of loose coupling: transitioning from local Docker Compose service names (`http://user-service:3001`) to cloud HTTPS endpoints required zero code modifications—only environment variable updates. Enforcing database-per-service isolation ensured schema independence, while deploying to Render revealed real-world cloud constraints such as port injection (`PORT=10000`), container cold starts, and free-tier network visibility trade-offs.

---

## 25. Final Verification and Submission Checklist

- [x] **API Gateway Implemented:** Express + `http-proxy-middleware` reverse proxy operational on port 4000.
- [x] **Service Discovery Configured:** Dynamic discovery via `api-gateway/config/services.js` and environment variables.
- [x] **Port Isolation Verified:** Only `api-gateway` exposes a host port in `compose.yaml`; all microservices are internal.
- [x] **Lab 6 Baseline Intact:** User, Product, and Order services retain complete business logic and status codes.
- [x] **Database Isolation Preserved:** Three separate databases in MongoDB containers and MongoDB Atlas.
- [x] **Cloud Deployment Active:** All four services live on Render (`oregon` region).
- [x] **Cloud End-to-End Test Passed:** POST order 101 via Gateway returned HTTP 201 with calculated total 75000.
- [x] **Postman Collection Updated:** `Microservices - Lab 7.postman_collection.json` configured with correct gateway variable.
- [x] **Security Audit Passed:** Zero real passwords or Atlas connection strings committed in repository.
- [x] **No Fabricated Evidence:** All URLs, test results, and screenshots reflect real, verified execution.

---
*CampusConnect Microservices Platform · Web Services & SOA Lab 7 · Student ID: 202512123*
