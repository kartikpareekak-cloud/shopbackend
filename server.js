const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const seedAdminUser = require('./utils/seedAdmin');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminStatsRoutes = require('./routes/adminStatsRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Socket.io: broadcast stock updates
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
});

app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminStatsRoutes); // Admin stats and management

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.warn('MONGO_URI not set in env; server will still start but DB operations will fail');
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mahalaxmi', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected');
    // Create admin user if it doesn't exist
    await seedAdminUser();
  })
  .catch((err) => {
    console.error('Mongo connection error', err.message || err);
  })

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
