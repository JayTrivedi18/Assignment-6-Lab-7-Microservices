const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusconnect_products';

app.use(express.json());

// Product Schema
const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: [0.01, 'Price must be positive'] },
    description: { type: String, default: '', trim: true }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

productSchema.methods.toJSON = function () {
  return {
    id: this.id,
    name: this.name,
    price: this.price,
    description: this.description
  };
};

const Product = mongoose.model('Product', productSchema);

// MongoDB connection
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`[Product Service] Connected to MongoDB at ${MONGODB_URI}`))
  .catch((err) => console.error(`[Product Service] MongoDB connection error:`, err.message));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'product-service',
    port: PORT,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// GET /products - Retrieve all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ id: 1 });
    res.status(200).json({ products });
  } catch (err) {
    console.error('[Product Service] Error fetching products:', err.message);
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// GET /products/:id - Retrieve product by id
app.get('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Product ID must be a valid number' });
    }

    const product = await Product.findOne({ id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ product });
  } catch (err) {
    console.error(`[Product Service] Error fetching product ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

// POST /products - Create a new product
app.post('/products', async (req, res) => {
  try {
    const { id, name, price, description } = req.body;

    if (id === undefined || id === null || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Field "id" is required and must be a number' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Field "name" is required and cannot be empty' });
    }
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'Field "price" is required and must be a positive number' });
    }

    const numericId = Number(id);
    const numericPrice = Number(price);

    const existing = await Product.findOne({ id: numericId });
    if (existing) {
      return res.status(409).json({ error: `Product with id ${numericId} already exists` });
    }

    const newProduct = new Product({
      id: numericId,
      name: name.trim(),
      price: numericPrice,
      description: description ? String(description).trim() : ''
    });

    await newProduct.save();
    res.status(201).json({ product: newProduct });
  } catch (err) {
    console.error('[Product Service] Error creating product:', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /products/:id - Update product by id
app.put('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Product ID must be a valid number' });
    }

    const { name, price, description } = req.body;
    if (name === undefined && price === undefined && description === undefined) {
      return res.status(400).json({ error: 'Provide at least one field ("name", "price", "description") to update' });
    }

    const product = await Product.findOne({ id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Field "name" cannot be empty' });
      }
      product.name = name.trim();
    }

    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'Field "price" must be a positive number' });
      }
      product.price = Number(price);
    }

    if (description !== undefined) {
      product.description = String(description).trim();
    }

    await product.save();
    res.status(200).json({ product });
  } catch (err) {
    console.error(`[Product Service] Error updating product ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /products/:id - Delete product by id
app.delete('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Product ID must be a valid number' });
    }

    const deleted = await Product.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully', id });
  } catch (err) {
    console.error(`[Product Service] Error deleting product ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.listen(PORT, () => {
  console.log(`[Product Service] Server running on port ${PORT}`);
});
