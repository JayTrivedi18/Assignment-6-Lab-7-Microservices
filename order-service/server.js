const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusconnect_orders';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const HTTP_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || '3000', 10);

app.use(express.json());

// Order Schema
const orderSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true },
    productId: { type: Number, required: true },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    total: { type: Number, required: true },
    status: { type: String, default: 'CREATED', enum: ['CREATED', 'CONFIRMED', 'CANCELLED'] },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

orderSchema.methods.toJSON = function () {
  return {
    id: this.id,
    userId: this.userId,
    productId: this.productId,
    quantity: this.quantity,
    total: this.total,
    status: this.status,
    createdAt: this.createdAt
  };
};

const Order = mongoose.model('Order', orderSchema);

// MongoDB connection
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`[Order Service] Connected to MongoDB at ${MONGODB_URI}`))
  .catch((err) => console.error(`[Order Service] MongoDB connection error:`, err.message));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'order-service',
    port: PORT,
    userServiceUrl: USER_SERVICE_URL,
    productServiceUrl: PRODUCT_SERVICE_URL,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// GET /orders - Retrieve all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ id: 1 });
    res.status(200).json({ orders });
  } catch (err) {
    console.error('[Order Service] Error fetching orders:', err.message);
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

// GET /orders/:id - Retrieve order by id
app.get('/orders/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Order ID must be a valid number' });
    }

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({ order });
  } catch (err) {
    console.error(`[Order Service] Error fetching order ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// POST /orders - Create order with inter-service verification
app.post('/orders', async (req, res) => {
  try {
    const { id, userId, productId, quantity } = req.body;

    // 1. Basic body validation
    if (id === undefined || id === null || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Field "id" is required and must be a number' });
    }
    if (userId === undefined || userId === null || isNaN(Number(userId))) {
      return res.status(400).json({ error: 'Field "userId" is required and must be a number' });
    }
    if (productId === undefined || productId === null || isNaN(Number(productId))) {
      return res.status(400).json({ error: 'Field "productId" is required and must be a number' });
    }
    if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Field "quantity" is required and must be a positive number' });
    }

    const numericId = Number(id);
    const numericUserId = Number(userId);
    const numericProductId = Number(productId);
    const numericQuantity = Number(quantity);

    // Check duplicate order ID
    const existingOrder = await Order.findOne({ id: numericId });
    if (existingOrder) {
      return res.status(409).json({ error: `Order with id ${numericId} already exists` });
    }

    // 2. Inter-Service Call: Verify User via User Service REST API
    let userResponse;
    try {
      userResponse = await axios.get(`${USER_SERVICE_URL}/users/${numericUserId}`, {
        timeout: HTTP_TIMEOUT_MS
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: 'User not found' });
      }
      console.error(`[Order Service] User Service call failed:`, err.message);
      return res.status(503).json({ error: 'User Service unavailable' });
    }

    if (!userResponse || !userResponse.data || !userResponse.data.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3. Inter-Service Call: Verify Product via Product Service REST API
    let productResponse;
    try {
      productResponse = await axios.get(`${PRODUCT_SERVICE_URL}/products/${numericProductId}`, {
        timeout: HTTP_TIMEOUT_MS
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error(`[Order Service] Product Service call failed:`, err.message);
      return res.status(503).json({ error: 'Product Service unavailable' });
    }

    if (!productResponse || !productResponse.data || !productResponse.data.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResponse.data.product;
    const total = Number((product.price * numericQuantity).toFixed(2));

    // 4. Create and persist Order
    const newOrder = new Order({
      id: numericId,
      userId: numericUserId,
      productId: numericProductId,
      quantity: numericQuantity,
      total,
      status: 'CREATED'
    });

    await newOrder.save();
    console.log(`[Order Service] Successfully created order ${numericId} (Total: ${total})`);
    res.status(201).json({ order: newOrder });
  } catch (err) {
    console.error('[Order Service] Error creating order:', err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.listen(PORT, () => {
  console.log(`[Order Service] Server running on port ${PORT}`);
  console.log(`[Order Service] Inter-service URLs: User=${USER_SERVICE_URL}, Product=${PRODUCT_SERVICE_URL}`);
});
