FROM node:22

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Gateway listens on this port (matches GATEWAY_PORT env var default)
EXPOSE 4000

CMD ["node", "server.js"]
