const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusconnect_users';

app.use(express.json());

// User Schema
const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

userSchema.methods.toJSON = function () {
  return {
    id: this.id,
    name: this.name,
    email: this.email
  };
};

const User = mongoose.model('User', userSchema);

// MongoDB connection
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`[User Service] Connected to MongoDB at ${MONGODB_URI}`))
  .catch((err) => console.error(`[User Service] MongoDB connection error:`, err.message));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'user-service',
    port: PORT,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// GET /users - Retrieve all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ id: 1 });
    res.status(200).json({ users });
  } catch (err) {
    console.error('[User Service] Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// GET /users/:id - Retrieve user by id
app.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'User ID must be a valid number' });
    }

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error(`[User Service] Error fetching user ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// POST /users - Create a new user
app.post('/users', async (req, res) => {
  try {
    const { id, name, email } = req.body;

    if (id === undefined || id === null || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Field "id" is required and must be a number' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Field "name" is required and cannot be empty' });
    }
    if (!email || typeof email !== 'string' || !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Field "email" is required and must be a valid email format' });
    }

    const numericId = Number(id);
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate
    const existing = await User.findOne({
      $or: [{ id: numericId }, { email: cleanEmail }]
    });

    if (existing) {
      if (existing.id === numericId) {
        return res.status(409).json({ error: `User with id ${numericId} already exists` });
      }
      return res.status(409).json({ error: `User with email '${cleanEmail}' already exists` });
    }

    const newUser = new User({
      id: numericId,
      name: name.trim(),
      email: cleanEmail
    });

    await newUser.save();
    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('[User Service] Error creating user:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /users/:id - Update user by id
app.put('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'User ID must be a valid number' });
    }

    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ error: 'Provide at least "name" or "email" to update' });
    }

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Field "name" cannot be empty' });
      }
      user.name = name.trim();
    }

    if (email) {
      if (typeof email !== 'string' || !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Field "email" must be a valid email format' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const duplicate = await User.findOne({ email: cleanEmail, id: { $ne: id } });
      if (duplicate) {
        return res.status(409).json({ error: `Email '${cleanEmail}' is already in use by another user` });
      }
      user.email = cleanEmail;
    }

    await user.save();
    res.status(200).json({ user });
  } catch (err) {
    console.error(`[User Service] Error updating user ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /users/:id - Delete user by id
app.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'User ID must be a valid number' });
    }

    const deleted = await User.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully', id });
  } catch (err) {
    console.error(`[User Service] Error deleting user ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.listen(PORT, () => {
  console.log(`[User Service] Server running on port ${PORT}`);
});
