# Lab 7 — Docker Run Commands
# ══════════════════════════════════════════════════════
# Open PowerShell and run these commands one by one.
# ══════════════════════════════════════════════════════

# Step 1 — Navigate to project
cd "D:\Web Services & SOA\Assignment_6_202512123"

# Step 2 — Validate compose YAML syntax
docker compose config

# Step 3 — Build all images (first run takes ~3-5 minutes)
docker compose build

# Step 4 — Start all services in background
docker compose up -d

# Step 5 — Check container status (gateway should show port 4000, others no ports)
docker compose ps

# Step 6 — View gateway startup logs (should see service registry)
docker compose logs api-gateway

# Step 7 — Test gateway health
curl http://localhost:4000/health

# Step 8 — Test gateway → User
curl http://localhost:4000/users

# Step 9 — Test gateway → Product
curl http://localhost:4000/products

# Step 10 — Test gateway → Order
curl http://localhost:4000/orders

# ══════════════════════════════════════════════════════
# Error Handling Test — 502 on stopped service
# ══════════════════════════════════════════════════════
docker compose stop user-service
curl http://localhost:4000/users
# Expected: {"error":"Service unavailable","service":"user-service",...}

docker compose start user-service
curl http://localhost:4000/users
# Expected: {"users":[...]}  (recovery)

# ══════════════════════════════════════════════════════
# Network inspection
# ══════════════════════════════════════════════════════
docker network inspect campus-network

# ══════════════════════════════════════════════════════
# Stop everything
# ══════════════════════════════════════════════════════
docker compose down
