const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/memory', require('./routes/memoryRoutes'));
app.use('/api/process', require('./routes/processRoutes'));
app.use('/api/algorithms', require('./routes/algorithmRoutes'));
app.use('/api/python-ml', require('./routes/pythonMLRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Memory Management System Backend Running' });
});

// Python ML Service health check
app.get('/api/python-ml-status', async (req, res) => {
  try {
    const { pythonMLClient } = require('./services/pythonMLClient');
    const result = await pythonMLClient.healthCheck();
    res.json({
      status: result.available ? 'Connected' : 'Disconnected',
      pythonService: result
    });
  } catch (error) {
    res.json({ status: 'Error', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Memory Management System Backend Started`);
});
