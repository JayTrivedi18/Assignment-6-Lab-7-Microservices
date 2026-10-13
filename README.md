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
5. [Why an API Gateway?](#5-why-an-api-gateway)
6. [API Gateway Responsibilities](#6-api-gateway-responsibilities)
7. [Service Registry and Configuration](#7-service-registry-and-configuration)
8. [Static vs. Dynamic Service Discovery](#8-static-vs-dynamic-service-discovery)
9. [User Service Responsibilities and Endpoints](#9-user-service-responsibilities-and-endpoints)
10. [Product Service Responsibilities and Endpoints](#10-product-service-responsibilities-and-endpoints)
11. [Order Service Responsibilities and Endpoints](#11-order-service-responsibilities-and-endpoints)
12. [Database-Per-Service Ownership](#12-database-per-service-ownership)
13. [Local Docker Architecture](#13-local-docker-architecture)
14. [Dockerfiles and Container Images](#14-dockerfiles-and-container-images)
15. [Docker Network and DNS](#15-docker-network-and-dns)
16. [Environment Variables Reference](#16-environment-variables-reference)
17. [Inter-Service Communication](#17-inter-service-communication)
18. [Error Handling](#18-error-handling)
19. [Postman Testing](#19-postman-testing)
20. [Cloud Deployment](#20-cloud-deployment)
21. [Actual Render URLs](#21-actual-render-urls)
22. [MongoDB Atlas](#22-mongodb-atlas)
23. [Cloud Verification Results](#23-cloud-verification-results)
24. [Cloud and Free-Tier Limitation](#24-cloud-and-free-tier-limitation)
25. [Local vs. Cloud Service URLs](#25-local-vs-cloud-service-urls)
26. [Troubleshooting](#26-troubleshooting)
27. [Reflection](#27-reflection)
28. [Final Verification and Submission Checklist](#28-final-verification-and-submission-checklist)

---

## 1. Project Overview

**CampusConnect** is a university microservices platform designed across two progressive lab assignments:

- **Lab 6 Baseline:** Implemented three core microservices (`user-service`, `product-service`, `order-service`) with isolated local MongoDB databases and direct inter-service REST communication.
- **Lab 7 Extension:** Introduces an **API Gateway** acting as the single external facade, implements **configuration-based service discovery** using environment variables, isolates backend services behind an internal Docker bridge network, and deploys the entire distributed system to the **Render** cloud platform with **MongoDB Atlas**.

### Repository Structure

```
Assignment_7_202512123/
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
├── screenshots/                 ← Execution and deployment evidence (23 screenshots: 12 local, 11 cloud)
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

## 5. Why an API Gateway?

An API Gateway is a core architectural pattern in microservices systems that provides:

1. **A single entry point for clients:** Consolidates all external client traffic through one centralized host and port (`localhost:4000` locally, or the public Render gateway URL) rather than requiring clients to connect to and manage multiple disparate microservices.
2. **A simpler client interface that hides internal service locations:** Frontend and mobile consumers interact with clean, unified resource routes (`/users`, `/products`, `/orders`) without needing awareness of backend ports (`3001`, `3002`, `3003`), internal IP addresses, or internal network topology.
3. **Centralized request logging and upstream error handling:** Cross-cutting concerns—such as uniform inbound/outbound request lifecycle logging and converting upstream network dropouts or crashed services into clean HTTP 502 Bad Gateway JSON responses—are managed centrally at the gateway boundary instead of being duplicated across every microservice.
4. **Loose coupling between clients and individual microservices:** Upstream services can be relocated, reconfigured, or refactored without breaking client contracts, isolating consumers from backend infrastructure changes.

In CampusConnect, the gateway routes `/users/*`, `/products/*`, and `/orders/*` to their respective microservices while handling `/health` locally, demonstrating all four architectural principles.

---

## 6. API Gateway Responsibilities

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

## 7. Service Registry and Configuration

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

## 8. Static vs. Dynamic Service Discovery

### Static / Configuration-Based Service Discovery (Implemented in CampusConnect)

CampusConnect uses **static, configuration-based service discovery** driven by environment variables:

- **Startup Configuration:** At startup, [`api-gateway/config/services.js`](api-gateway/config/services.js) resolves upstream locations from `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, and `ORDER_SERVICE_URL` (falling back to local Docker Compose network defaults).
- **Decoupled Architecture:** Upstream service endpoints are externalized from application source code. Switching from local Docker (`http://user-service:3001`) to Render cloud (`https://campusconnect-user-service-name.onrender.com`) requires changing environment variables without modifying or rebuilding application code.
- **Trade-offs:** This approach requires zero additional infrastructure (no dedicated service discovery cluster or daemon), offers predictable routing, and is easily inspectable via `GET /health`. However, service addresses must be known beforehand, and URL changes require restarting the gateway container or service.

### Contrast: Dynamic Service Discovery (Consul / Eureka)

In large-scale or auto-scaling architectures, **dynamic service registries** such as **HashiCorp Consul** or **Netflix Eureka** are employed:

- **Self-Registration & Heartbeats:** Microservice instances register their ephemeral network location (IP and port) with a central registry upon startup and send periodic heartbeats (TTL checks).
- **Dynamic Resolution & Deregistration:** The API Gateway queries the registry dynamically at request time to route traffic and load balance across multiple running instances. If an instance crashes or fails health checks, the registry automatically deregisters it.
- **Operational Complexity:** Dynamic registries add operational overhead, requiring high-availability registry clusters, heartbeat monitoring, and distributed state management.

### Cluster-Native Discovery: Kubernetes DNS

Within a Kubernetes cluster, **Kubernetes DNS** provides service-name-based discovery:

- Kubernetes automatically assigns a consistent DNS name (e.g., `user-service.default.svc.cluster.local`) to each `Service` resource.
- The internal CoreDNS server and `kube-proxy` resolve and load-balance requests across the dynamic set of healthy underlying pods transparently.

> **Project Clarification:** This project strictly uses static, environment-variable-based service discovery. It does **not** implement dynamic registries such as Consul or Eureka, nor does it run Kubernetes DNS.

---

## 9. User Service Responsibilities and Endpoints

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

## 10. Product Service Responsibilities and Endpoints

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

## 11. Order Service Responsibilities and Endpoints

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

## 12. Database-Per-Service Ownership

Each microservice possesses exclusive ownership over its persistent datastore. No microservice is permitted direct read or write access to another service's database.

| Service | Dedicated Database | Collections | Data Ownership Scope |
|---|---|---|---|
| **User Service** | `campusconnect_users` | `users` | User credentials, profiles, email indexing |
| **Product Service** | `campusconnect_products` | `products` | Catalog metadata, inventory pricing |
| **Order Service** | `campusconnect_orders` | `orders` | Transaction records, calculated totals, order status |

- In local Docker, three isolated `mongo:7` containers are created (`user-mongodb`, `product-mongodb`, `order-mongodb`).
- In cloud deployment, three isolated databases reside inside the `Student-API` MongoDB Atlas cluster.

---

## 13. Local Docker Architecture

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

## 14. Dockerfiles and Container Images

All four custom services use `node:22` base images (not Node.js 18 Alpine):

- [`api-gateway/Dockerfile`](api-gateway/Dockerfile): Uses `node:22`, runs `npm ci --omit=dev` for an optimized, repeatable production dependency install, and exposes port `4000`.
- [`user-service/Dockerfile`](user-service/Dockerfile): Uses `node:22`, runs `npm install`, and exposes internal port `3001`.
- [`product-service/Dockerfile`](product-service/Dockerfile): Uses `node:22`, runs `npm install`, and exposes internal port `3002`.
- [`order-service/Dockerfile`](order-service/Dockerfile): Uses `node:22`, runs `npm install`, and exposes internal port `3003`.

All four service directories include a `.dockerignore` file preventing `node_modules`, npm debug logs, and `.env` files from leaking into container images.

---

## 15. Docker Network and DNS

The Docker daemon provides automatic internal DNS resolution across the `campus-network` bridge:
- `http://user-service:3001` resolves directly to the internal IP of the User Service container.
- `http://product-service:3002` resolves directly to the internal IP of the Product Service container.
- `http://order-service:3003` resolves directly to the internal IP of the Order Service container.

Cross-service communication occurs securely on this bridge without exposing internal container ports to the host machine or public internet.

---

## 16. Environment Variables Reference

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

## 17. Inter-Service Communication

When `POST /orders` is received by the Order Service:

1. **User Validation:** Calls `GET ${USER_SERVICE_URL}/users/:userId` via Axios.
   - If user does not exist: returns **404 Not Found** (`{"error": "User not found"}`).
2. **Product Validation & Pricing:** Calls `GET ${PRODUCT_SERVICE_URL}/products/:productId` via Axios.
   - If product does not exist: returns **404 Not Found** (`{"error": "Product not found"}`).
3. **Calculation:** Computes order total (`product.price * quantity`).
4. **Order Persistence:** Stores the order in `campusconnect_orders` with status `CREATED`.
5. **Resilience:** If either upstream service is unreachable or times out (3000ms), returns **503 Service Unavailable** (`{"error": "User service unavailable"}` or `{"error": "Product service unavailable"}`).

---

## 18. Error Handling

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

## 19. Postman Testing

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

## 20. Cloud Deployment

The application is deployed on [Render](https://render.com) using Docker runtimes:

- **Deployment Order:**
  1. `campusconnect-user-service` → Copy assigned HTTPS URL.
  2. `campusconnect-product-service` → Copy assigned HTTPS URL.
  3. `campusconnect-order-service` → Set `USER_SERVICE_URL` and `PRODUCT_SERVICE_URL` to above URLs.
  4. `campusconnect-api-gateway` → Set `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL` to the three service URLs.
- **Blueprint Reference:** A complete deployment specification is maintained in [`render.yaml`](render.yaml) for automated multi-service scaffolding.

---

## 21. Actual Render URLs

The live, verified cloud endpoints on Render are:

| Service | Public Render HTTPS URL | Role |
|---|---|---|
| **API Gateway** | `https://campusconnect-api-gateway-6k62.onrender.com` | **Intended Public Entry Point** |
| **User Service** | `https://campusconnect-user-service-name.onrender.com` | User CRUD & Atlas backend |
| **Product Service** | `https://campusconnect-product-service-hhvy.onrender.com` | Product catalog & Atlas backend |
| **Order Service** | `https://campusconnect-order-service-69zf.onrender.com` | Order orchestration & Atlas backend |

> **Note on Product Service Hostname:** The active verified Render subdomain is `hhvy`.

---

## 22. MongoDB Atlas

- **Atlas Cluster:** `Student-API` (M0 Free tier, Region: AWS / us-east-1)
- **Database Segregation:**
  - `campusconnect_users`
  - `campusconnect_products`
  - `campusconnect_orders`
- **Network Access:** Whitelisted `0.0.0.0/0` to allow incoming connections from dynamic Render IP ranges.
- **Security Compliance:** Connection URIs are stored exclusively as Render Secret Environment Variables (`sync: false` in `render.yaml`) and never committed to version control.

---

## 23. Cloud Verification Results

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

#### Local Docker Evidence (12 Screenshots in `screenshots/`)

| Screenshot File | Verification Scope | Status |
|---|---|---|
| `Screenshot 2026-09-29 100011.png` | Docker Compose running all 7 containers (`docker compose ps`) with port 4000 isolated | ✅ Verified |
| `Screenshot 2026-09-29 100034.png` | Gateway health check (`GET http://localhost:4000/health` → 200 OK) | ✅ Verified |
| `Screenshot 2026-09-29 100127.png` | Gateway proxy routing to User Service (`GET /users` → 200 OK) | ✅ Verified |
| `Screenshot 2026-09-29 100607.png` | End-to-end order placement via Gateway (`POST /orders` → 201 Created) | ✅ Verified |
| `Screenshot 2026-09-29 101801.png` | Gateway controlled 502 error handling (`user-service` container stopped) | ✅ Verified |
| `Screenshot 2026-09-29 102131.png` | Service discovery test — Gateway health before URL reconfiguration | ✅ Verified |
| `Screenshot 2026-09-29 102203.png` | Service discovery test — Gateway health after URL reconfiguration | ✅ Verified |
| `Screenshot 2026-09-29 102511.png` | Service discovery test — Gateway health restoration verified | ✅ Verified |
| `Screenshot 2026-09-29 102923.png` | Gateway error handling for unmapped route (`GET /unknown` → 404 Not Found) | ✅ Verified |
| `Screenshot 2026-09-29 102944.png` | Order Service validation error for non-existent `userId` (`POST /orders` → 404 Not Found) | ✅ Verified |
| `Screenshot 2026-09-29 102959.png` | Gateway proxy routing to Product Service (`GET /products` → 200 OK) | ✅ Verified |
| `Screenshot 2026-09-29 103225.png` | Gateway proxy routing to Order Service (`GET /orders` → 200 OK) | ✅ Verified |

#### Cloud Deployment Evidence (11 Screenshots in `screenshots/`)

| Screenshot File | Verification Scope | Status |
|---|---|---|
| `Screenshot 2026-09-29 182428.png` | Direct Product Service: `GET https://campusconnect-product-service-hhvy.onrender.com/products` → `200 OK` (empty catalog initial state `[]`) | ✅ Verified |
| `Screenshot 2026-09-29 182712.png` | Direct Order Service: `GET https://campusconnect-order-service-69zf.onrender.com/orders` → `200 OK` (empty orders initial state `[]`) | ✅ Verified |
| `Screenshot 2026-09-29 183014.png` | Direct Product Service: `POST https://campusconnect-product-service-hhvy.onrender.com/products` creates Product 1 ("Laptop", 75000) → `201 Created` | ✅ Verified |
| `Screenshot 2026-09-29 183034.png` | Direct Product Service: `GET https://campusconnect-product-service-hhvy.onrender.com/products` verifies Product 1 in catalog → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 185510.png` | Direct User Service: `GET https://campusconnect-user-service-name.onrender.com/users/1` verifies User 1 ("Jay Trivedi") → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 185617.png` | Direct Order Service: `POST https://campusconnect-order-service-69zf.onrender.com/orders` creates Order 100 with total 75000 → `201 Created` | ✅ Verified |
| `Screenshot 2026-09-29 185719.png` | Direct Order Service: `GET https://campusconnect-order-service-69zf.onrender.com/orders` verifies Order 100 in database → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 190731.png` | Cloud API Gateway: `GET https://campusconnect-api-gateway-6k62.onrender.com/users` proxies to User Service returning User 1 → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 190757.png` | Cloud API Gateway: `GET https://campusconnect-api-gateway-6k62.onrender.com/products` proxies to Product Service returning Product 1 → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 190837.png` | Cloud API Gateway: `GET https://campusconnect-api-gateway-6k62.onrender.com/orders` proxies to Order Service returning Order 100 → `200 OK` | ✅ Verified |
| `Screenshot 2026-09-29 191006.png` | Cloud API Gateway: `POST https://campusconnect-api-gateway-6k62.onrender.com/orders` proxies order creation (ID 101, total 75000) → `201 Created` | ✅ Verified |

#### Cloud Verification Summary

- All 23 screenshot files exist in [`screenshots/`](screenshots/) and have been individually audited and matched against real execution artifacts.
- Local Docker evidence covers container isolation, gateway routing, health checks, service discovery configuration mutation/recovery, and controlled 502/404 error handling.
- Cloud deployment evidence covers direct microservice verification, data persistence in MongoDB Atlas, and full end-to-end order orchestration proxied through the live API Gateway on Render.

---

## 24. Cloud and Free-Tier Limitation

Under Render's free tier, all instances are deployed as **Render Web Services**, which automatically assign public HTTPS domains (`onrender.com`).

- **Architecture Intent:** The API Gateway is the single intended client entry point for all operations.
- **Free-Tier Constraint:** Backend services (`user-service`, `product-service`, `order-service`) technically have public URLs due to platform plan limitations.
- **Enterprise / Production Design:** In a production deployment with private networking (or Render's paid Private Services `pserv`), backend services would be completely unexposed to the Internet, accessible only via internal VPC routing from the API Gateway.
- **Demonstration Integrity:** The application strictly implements configuration-based service discovery and gateway proxying in compliance with the Lab 7 specification.

---

## 25. Local vs. Cloud Service URLs

### Actual Environment Service URLs

| Service | Local Docker Compose (Internal Network) | Render Cloud Deployment (Configured URLs) |
|---|---|---|
| **API Gateway** | `http://localhost:4000` (Host interface) | `https://campusconnect-api-gateway-6k62.onrender.com` |
| **User Service** | `http://user-service:3001` | `https://campusconnect-user-service-name.onrender.com` |
| **Product Service** | `http://product-service:3002` | `https://campusconnect-product-service-hhvy.onrender.com` |
| **Order Service** | `http://order-service:3003` | `https://campusconnect-order-service-69zf.onrender.com` |

### Key Architectural Differences

1. **Local Docker Compose:** Internal service names such as `http://user-service:3001` are resolved exclusively within the internal Docker bridge network (`campus-network`). The Docker daemon's embedded DNS server maps container names to internal virtual IP addresses.
2. **Render Cloud Deployment:** The microservices run as independent Web Services with publicly accessible HTTPS URLs provided by Render's routing infrastructure.
3. **Public Client Access:** `https://campusconnect-api-gateway-6k62.onrender.com` serves as the sole public client entry point for all external consumers and Postman requests. Clients do not access backend services directly.
4. **Network Resolution Warning:** Docker service names (`http://user-service:3001`, etc.) **cannot and should not be assumed to resolve on Render**. Outside of the local Docker bridge network, container names have no DNS meaning.
5. **Decoupling via Environment Variables:** Service URLs are supplied dynamically through environment variables (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`). This guarantees that the exact same application code runs in local Docker Compose and in Render cloud without hardcoded hostnames or code modifications.

---

## 26. Troubleshooting

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

## 27. Reflection

In Lab 6, clients communicated directly with individual microservices across exposed host ports (`3001`, `3002`, `3003`) over a local Docker network, requiring clients to manage multiple endpoints with no centralized logging or unified error translation.
Lab 7 evolved this architecture by introducing a client-facing API Gateway on port `4000` as the single entry point, keeping backend microservices completely hidden inside an internal Docker bridge network.
By implementing configuration-based routing via environment variables (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`), service locations were decoupled from application code, allowing the exact same codebase to run locally and in the cloud.
The gateway centralized request logging and converted upstream connection drops into structured HTTP 502 Bad Gateway responses rather than raw connection resets.
Finally, deploying the distributed system to Render with MongoDB Atlas demonstrated real-world cloud considerations, including environment variable injection, platform port assignment, and free-tier cold-start latencies.

---

## 28. Final Verification and Submission Checklist

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
